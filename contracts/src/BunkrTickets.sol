// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BunkrTickets
/// @notice Bunker Deeds and Ration Tickets.
///         - Your $BUNKR balance sets your Deed tier (read live, no transaction).
///         - Every run costs one Ration Ticket. Each Deed gets one free ticket per UTC day.
///         - Bought tickets are paid in $BUNKR: part is burned, the rest goes to that day's
///           Daily Doom pot, which the results oracle pays out to the leaderboard.
///         - Daily Doom has its own entry fee, mostly into the pot, so the prize grows with
///           every player. Anyone (the creator-fee wallet, sponsors) can top up a day's pot.
contract BunkrTickets is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev The coin template may not expose burn(), so burning means sending here.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint8 public constant TIER_NONE = 0;
    uint8 public constant TIER_SHED = 1;
    uint8 public constant TIER_BASEMENT = 2;
    uint8 public constant TIER_BUNKER = 3;
    uint8 public constant TIER_SILO = 4;
    uint16 public constant BPS = 10_000;

    IERC20 public immutable bunkr;

    /// @notice Minimum balance for Shed, Basement, Bunker and Silo.
    uint256[4] public tierThresholds;
    uint256 public ticketPrice;
    uint16 public burnBps;
    /// @notice What one Daily Doom attempt costs, and the share of it that goes to the pot.
    uint256 public dailyFee;
    uint16 public dailyPotBps;
    /// @notice Signs off game results and settles pots. The game server, eventually.
    address public oracle;

    mapping(address => uint256) public tickets;
    /// @dev UTC day + 1 of the last free ticket used (0 = never).
    mapping(address => uint256) private _lastFreeDay;
    /// @dev UTC day + 1 of the last Daily Doom entry (0 = never). One attempt per day.
    mapping(address => uint256) private _lastDailyDay;
    mapping(uint256 => uint256) public pot;
    mapping(uint256 => bool) public settled;
    uint256 public runCount;
    /// @notice Who started each run, so the Forge can check who may lock Bags into it.
    mapping(uint256 => address) public runPlayer;

    event TicketsBought(address indexed player, uint256 qty, uint256 burned, uint256 toPot, uint256 indexed day);
    event RunEntered(
        address indexed player, uint256 indexed runId, uint256 indexed day, bool daily, bool free, uint8 tier, bytes32 commit
    );
    event DaySettled(uint256 indexed day, uint256 amount, address[] winners, uint16[] shareBps);
    event PotRolled(uint256 indexed fromDay, uint256 indexed toDay, uint256 amount);
    event ConfigChanged(uint256[4] tierThresholds, uint256 ticketPrice, uint16 burnBps);
    event DailyConfigChanged(uint256 dailyFee, uint16 dailyPotBps);
    event DailyEntered(address indexed player, uint256 indexed day, uint256 burned, uint256 toPot);
    event PotFunded(address indexed from, uint256 indexed day, uint256 amount);
    event OracleChanged(address oracle);

    error NoDeed();
    error NoTicket();
    error DailyAlreadyPlayed();
    error BadQty();
    error NotOracle();
    error DayNotOver();
    error AlreadySettled();
    error BadShares();
    error BadConfig();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(
        IERC20 bunkr_,
        address owner_,
        address oracle_,
        uint256[4] memory thresholds,
        uint256 price,
        uint16 burnBps_,
        uint256 dailyFee_,
        uint16 dailyPotBps_
    ) Ownable(owner_) {
        bunkr = bunkr_;
        oracle = oracle_;
        _setConfig(thresholds, price, burnBps_);
        _setDaily(dailyFee_, dailyPotBps_);
        emit OracleChanged(oracle_);
    }

    // ---------------------------------------------------------------- views

    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function tierOf(address player) public view returns (uint8) {
        uint256 bal = bunkr.balanceOf(player);
        for (uint8 t = 4; t > 0; t--) {
            if (bal >= tierThresholds[t - 1]) return t;
        }
        return TIER_NONE;
    }

    function dailyAvailable(address player) public view returns (bool) {
        return _lastDailyDay[player] != today() + 1;
    }

    function freeTicketAvailable(address player) public view returns (bool) {
        return tierOf(player) >= TIER_SHED && _lastFreeDay[player] != today() + 1;
    }

    function getTierThresholds() external view returns (uint256[4] memory) {
        return tierThresholds;
    }

    /// @notice Everything the game needs in one call.
    function playerState(address player)
        external
        view
        returns (uint8 tier, uint256 balance, uint256 ticketCount, bool freeAvailable, uint256 todaysPot)
    {
        return (tierOf(player), bunkr.balanceOf(player), tickets[player], freeTicketAvailable(player), pot[today()]);
    }

    // ---------------------------------------------------------------- players

    function buyTickets(uint256 qty) external nonReentrant {
        _buy(qty);
    }

    /// @notice One signature instead of an approve transaction (Urufu coins support Permit).
    function buyTicketsWithPermit(uint256 qty, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        // If someone front-ran the permit, the allowance is already there; let transferFrom decide.
        try IERC20Permit(address(bunkr)).permit(msg.sender, address(this), qty * ticketPrice, deadline, v, r, s) {} catch {}
        _buy(qty);
    }

    /// @notice Start a run. A normal run spends a ticket (today's free one first); Daily Doom
    ///         charges dailyFee instead, most of it straight into today's pot.
    /// @param commit keccak256 of a secret only the player's game client knows. The results
    ///        server only accepts this run's result from whoever can reveal it.
    function enterRun(bool daily, bytes32 commit) external nonReentrant returns (uint256 runId) {
        return _enter(daily, commit);
    }

    /// @notice Daily Doom with one signature instead of an approve transaction.
    function enterDailyWithPermit(bytes32 commit, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        nonReentrant
        returns (uint256 runId)
    {
        try IERC20Permit(address(bunkr)).permit(msg.sender, address(this), dailyFee, deadline, v, r, s) {} catch {}
        return _enter(true, commit);
    }

    /// @notice Add to a day's Daily Doom pot: creator fees, sponsors, anyone.
    function fundPot(uint256 day, uint256 amount) external nonReentrant {
        if (day < today() || settled[day]) revert DayNotOver();
        bunkr.safeTransferFrom(msg.sender, address(this), amount);
        pot[day] += amount;
        emit PotFunded(msg.sender, day, amount);
    }

    function _enter(bool daily, bytes32 commit) internal returns (uint256 runId) {
        uint8 tier = tierOf(msg.sender);
        if (tier == TIER_NONE) revert NoDeed();
        if (daily) {
            if (_lastDailyDay[msg.sender] == today() + 1) revert DailyAlreadyPlayed();
            _lastDailyDay[msg.sender] = today() + 1;
            uint256 toPot = (dailyFee * dailyPotBps) / BPS;
            uint256 burned = dailyFee - toPot;
            bunkr.safeTransferFrom(msg.sender, address(this), dailyFee);
            if (burned > 0) bunkr.safeTransfer(DEAD, burned);
            pot[today()] += toPot;
            emit DailyEntered(msg.sender, today(), burned, toPot);
            runId = ++runCount;
            runPlayer[runId] = msg.sender;
            emit RunEntered(msg.sender, runId, today(), true, false, tier, commit);
            return runId;
        }
        bool free = _lastFreeDay[msg.sender] != today() + 1;
        if (free) {
            _lastFreeDay[msg.sender] = today() + 1;
        } else {
            if (tickets[msg.sender] == 0) revert NoTicket();
            tickets[msg.sender]--;
        }
        runId = ++runCount;
        runPlayer[runId] = msg.sender;
        emit RunEntered(msg.sender, runId, today(), false, free, tier, commit);
    }

    // ---------------------------------------------------------------- oracle

    /// @notice Pay a finished day's pot to the Daily Doom leaderboard.
    function settleDay(uint256 day, address[] calldata winners, uint16[] calldata shareBps)
        external
        onlyOracle
        nonReentrant
    {
        if (day >= today()) revert DayNotOver();
        if (settled[day]) revert AlreadySettled();
        if (winners.length == 0 || winners.length != shareBps.length) revert BadShares();
        uint256 total;
        for (uint256 i; i < shareBps.length; i++) total += shareBps[i];
        if (total != BPS) revert BadShares();

        settled[day] = true;
        uint256 amount = pot[day];
        pot[day] = 0;
        uint256 paid;
        for (uint256 i; i < winners.length; i++) {
            uint256 share = i == winners.length - 1 ? amount - paid : (amount * shareBps[i]) / BPS;
            paid += share;
            if (share > 0) bunkr.safeTransfer(winners[i], share);
        }
        emit DaySettled(day, amount, winners, shareBps);
    }

    /// @notice Nobody played a day? Its pot rolls into today's.
    function rollDay(uint256 day) external onlyOracle {
        if (day >= today()) revert DayNotOver();
        if (settled[day]) revert AlreadySettled();
        settled[day] = true;
        uint256 amount = pot[day];
        pot[day] = 0;
        pot[today()] += amount;
        emit PotRolled(day, today(), amount);
    }

    // ---------------------------------------------------------------- owner

    function setConfig(uint256[4] calldata thresholds, uint256 price, uint16 burnBps_) external onlyOwner {
        _setConfig(thresholds, price, burnBps_);
    }

    function setDaily(uint256 fee, uint16 potBps) external onlyOwner {
        _setDaily(fee, potBps);
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }

    // ---------------------------------------------------------------- internal

    function _buy(uint256 qty) internal {
        if (qty == 0 || qty > 100) revert BadQty();
        uint256 cost = qty * ticketPrice;
        uint256 burned = (cost * burnBps) / BPS;
        uint256 toPot = cost - burned;
        uint256 day = today();
        bunkr.safeTransferFrom(msg.sender, address(this), cost);
        if (burned > 0) bunkr.safeTransfer(DEAD, burned);
        pot[day] += toPot;
        tickets[msg.sender] += qty;
        emit TicketsBought(msg.sender, qty, burned, toPot, day);
    }

    function _setDaily(uint256 fee, uint16 potBps) internal {
        if (potBps > BPS) revert BadConfig();
        dailyFee = fee;
        dailyPotBps = potBps;
        emit DailyConfigChanged(fee, potBps);
    }

    function _setConfig(uint256[4] memory thresholds, uint256 price, uint16 burnBps_) internal {
        if (burnBps_ > BPS || thresholds[0] == 0) revert BadConfig();
        for (uint256 i = 1; i < 4; i++) {
            if (thresholds[i] <= thresholds[i - 1]) revert BadConfig();
        }
        tierThresholds = thresholds;
        ticketPrice = price;
        burnBps = burnBps_;
        emit ConfigChanged(thresholds, price, burnBps_);
    }
}

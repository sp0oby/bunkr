// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BunkrForge} from "./BunkrForge.sol";
import {BunkrTickets} from "./BunkrTickets.sol";

/// @title BunkrStockForge
/// @notice The Stonk Exchange: legendary Stock Bags, bought with a Robinhood stock token plus
///         a $BUNKR burn. Each Bag is an item on BunkrForge (this contract is one of its
///         minters), so it works like any forged Bag: bring it into runs, trade it. Stock Bags
///         are marked unbreakable on the Forge, so they never shatter.
///         Where the stock goes: `potBps` of it into this week's Stonk Pot, which the results
///         oracle pays to the week's Daily Doom leaderboard; the rest to the treasury.
///         Weeks start Monday 00:00 UTC, the same as the game's weekly rotation.
contract BunkrStockForge is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint16 public constant BPS = 10_000;

    BunkrForge public immutable forge;
    IERC20 public immutable bunkr;
    BunkrTickets public immutable deeds;
    address public treasury;
    address public oracle;
    /// @notice Share of each sale's stock that goes into the Stonk Pot (the rest to the treasury).
    uint16 public potBps;

    struct Listing {
        IERC20 stock;
        /// @notice Stock token (18 decimals) per Bag.
        uint128 price;
        /// @notice $BUNKR burned per Bag.
        uint128 burn;
        uint32 cap;
        uint32 sold;
        uint8 minTier;
        bool enabled;
    }

    /// @notice Forge item id => its listing.
    mapping(uint256 => Listing) public listings;
    uint256[] private _ids;

    /// @notice Stonk Pot per week, per stock token.
    mapping(uint256 => mapping(address => uint256)) public stonkPot;
    mapping(uint256 => address[]) private _potTokens;
    mapping(uint256 => mapping(address => bool)) private _inPot;
    mapping(uint256 => bool) public weekSettled;

    event Bought(address indexed player, uint256 indexed id, address indexed stock, uint256 price, uint256 toPot, uint256 burned);
    event ListingSet(uint256 indexed id, address stock, uint128 price, uint128 burn, uint32 cap, uint8 minTier, bool enabled);
    event PotFunded(address indexed from, uint256 indexed week, address indexed token, uint256 amount);
    event WeekSettled(uint256 indexed week, address[] winners, uint16[] shareBps);
    event WeekRolled(uint256 indexed fromWeek, uint256 indexed toWeek);
    event TreasuryChanged(address treasury);
    event OracleChanged(address oracle);
    event PotShareChanged(uint16 potBps);

    error NotListed();
    error SoldOut();
    error TierTooLow(uint8 need, uint8 have);
    error NotOracle();
    error WeekNotOver();
    error AlreadySettled();
    error BadShares();
    error BadConfig();

    modifier onlyOracle() {
        if (msg.sender != oracle) revert NotOracle();
        _;
    }

    constructor(BunkrForge forge_, BunkrTickets deeds_, address owner_, address oracle_, address treasury_, uint16 potBps_)
        Ownable(owner_)
    {
        if (potBps_ > BPS || treasury_ == address(0)) revert BadConfig();
        forge = forge_;
        bunkr = forge_.bunkr();
        deeds = deeds_;
        oracle = oracle_;
        treasury = treasury_;
        potBps = potBps_;
        emit OracleChanged(oracle_);
        emit TreasuryChanged(treasury_);
        emit PotShareChanged(potBps_);
    }

    // ---------------------------------------------------------------- views

    /// @notice Weeks since 1970, starting on Mondays (1970-01-01 was a Thursday).
    function week() public view returns (uint256) {
        return (block.timestamp / 1 days + 3) / 7;
    }

    function listedIds() external view returns (uint256[] memory) {
        return _ids;
    }

    /// @notice What's in a week's Stonk Pot.
    function potOf(uint256 wk) external view returns (address[] memory tokens, uint256[] memory amounts) {
        tokens = _potTokens[wk];
        amounts = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; i++) amounts[i] = stonkPot[wk][tokens[i]];
    }

    // ---------------------------------------------------------------- players

    function buy(uint256 id) external nonReentrant {
        _buy(id);
    }

    /// @notice Buy with one Permit signature for the stock token instead of an approve
    ///         (Robinhood stock tokens support Permit). $BUNKR still needs its allowance.
    function buyWithPermit(uint256 id, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        Listing storage l = listings[id];
        try IERC20Permit(address(l.stock)).permit(msg.sender, address(this), l.price, deadline, v, r, s) {} catch {}
        _buy(id);
    }

    /// @notice Add to a week's Stonk Pot: sponsors, the treasury, anyone.
    function fundPot(uint256 wk, IERC20 token, uint256 amount) external nonReentrant {
        if (wk < week() || weekSettled[wk]) revert WeekNotOver();
        _addPot(wk, address(token), _pull(token, msg.sender, address(this), amount));
        emit PotFunded(msg.sender, wk, address(token), amount);
    }

    function _buy(uint256 id) internal {
        Listing storage l = listings[id];
        if (!l.enabled) revert NotListed();
        if (l.sold >= l.cap) revert SoldOut();
        uint8 tier = deeds.tierOf(msg.sender);
        if (tier < l.minTier) revert TierTooLow(l.minTier, tier);
        l.sold++;
        if (l.burn > 0) bunkr.safeTransferFrom(msg.sender, DEAD, l.burn);
        uint256 toPot = (uint256(l.price) * potBps) / BPS;
        // Measured, so the pot only ever counts what actually arrived.
        uint256 got = toPot > 0 ? _pull(l.stock, msg.sender, address(this), toPot) : 0;
        _addPot(week(), address(l.stock), got);
        if (l.price > toPot) l.stock.safeTransferFrom(msg.sender, treasury, l.price - toPot);
        forge.award(msg.sender, id, 1);
        emit Bought(msg.sender, id, address(l.stock), l.price, got, l.burn);
    }

    // ---------------------------------------------------------------- oracle

    /// @notice Pay a finished week's Stonk Pot to the week's Daily Doom leaderboard.
    function settleWeek(uint256 wk, address[] calldata winners, uint16[] calldata shareBps) external onlyOracle nonReentrant {
        if (wk >= week()) revert WeekNotOver();
        if (weekSettled[wk]) revert AlreadySettled();
        if (winners.length == 0 || winners.length != shareBps.length) revert BadShares();
        uint256 total;
        for (uint256 i; i < shareBps.length; i++) total += shareBps[i];
        if (total != BPS) revert BadShares();
        weekSettled[wk] = true;
        address[] memory tokens = _potTokens[wk];
        for (uint256 t; t < tokens.length; t++) {
            uint256 amount = stonkPot[wk][tokens[t]];
            stonkPot[wk][tokens[t]] = 0;
            uint256 paid;
            for (uint256 i; i < winners.length; i++) {
                uint256 share = i == winners.length - 1 ? amount - paid : (amount * shareBps[i]) / BPS;
                paid += share;
                if (share > 0) IERC20(tokens[t]).safeTransfer(winners[i], share);
            }
        }
        emit WeekSettled(wk, winners, shareBps);
    }

    /// @notice Nobody played Daily Doom that week? Its Stonk Pot rolls into this week's.
    function rollWeek(uint256 wk) external onlyOracle {
        if (wk >= week()) revert WeekNotOver();
        if (weekSettled[wk]) revert AlreadySettled();
        weekSettled[wk] = true;
        uint256 now_ = week();
        address[] memory tokens = _potTokens[wk];
        for (uint256 t; t < tokens.length; t++) {
            uint256 amount = stonkPot[wk][tokens[t]];
            stonkPot[wk][tokens[t]] = 0;
            _addPot(now_, tokens[t], amount);
        }
        emit WeekRolled(wk, now_);
    }

    // ---------------------------------------------------------------- owner

    /// @notice Add or change a Stock Bag. The cap can never drop below what's already sold.
    function setListing(uint256 id, IERC20 stock, uint128 price, uint128 burn, uint32 cap, uint8 minTier, bool enabled)
        external
        onlyOwner
    {
        Listing storage l = listings[id];
        if (address(l.stock) == address(0)) _ids.push(id);
        else if (address(stock) != address(l.stock)) revert BadConfig(); // a Bag's stock never changes
        if (address(stock) == address(0) || cap < l.sold) revert BadConfig();
        l.stock = stock;
        l.price = price;
        l.burn = burn;
        l.cap = cap;
        l.minTier = minTier;
        l.enabled = enabled;
        emit ListingSet(id, address(stock), price, burn, cap, minTier, enabled);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert BadConfig();
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }

    function setPotShare(uint16 potBps_) external onlyOwner {
        if (potBps_ > BPS) revert BadConfig();
        potBps = potBps_;
        emit PotShareChanged(potBps_);
    }

    // ---------------------------------------------------------------- internal

    function _pull(IERC20 token, address from, address to, uint256 amount) internal returns (uint256) {
        uint256 before = token.balanceOf(to);
        token.safeTransferFrom(from, to, amount);
        return token.balanceOf(to) - before;
    }

    function _addPot(uint256 wk, address token, uint256 amount) internal {
        if (amount == 0) return;
        if (!_inPot[wk][token]) {
            _inPot[wk][token] = true;
            _potTokens[wk].push(token);
        }
        stonkPot[wk][token] += amount;
    }
}

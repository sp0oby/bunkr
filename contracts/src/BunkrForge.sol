// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {BunkrTickets} from "./BunkrTickets.sol";

/// @title BunkrForge
/// @notice Forged Bags (ERC-1155). Forging burns $BUNKR and makes a Bag permanent, so you
///         can bring it into future runs or trade it. Rarer Bags need a higher Deed tier.
///         Bags you carry into a run are held here until the run is settled, so they can't
///         be moved out from under the stakes. Lose the run and the results oracle can
///         shatter (burn) some of them; everything else goes back to you. If the oracle never
///         settles, you can take them back yourself after RECLAIM_AFTER.
///         Built to grow without a redeploy: new items are just new recipe ids, approved
///         minters (a future season contract, say) can award items as prizes, holders can
///         burn their own items (or let an approved contract burn them), and marketplace
///         royalties go to whoever the owner sets.
contract BunkrForge is ERC1155Burnable, ERC1155Supply, ERC2981, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    /// @notice Collection name and symbol, for explorers and wallets.
    string public constant name = "BUNKR Forge";
    string public constant symbol = "BKRF";

    /// @dev Metadata lives at `<base><id>.json` (e.g. https://bunkr.game/meta/5.json).
    string private _base;
    string private _contractURI;

    struct Recipe {
        uint128 cost;
        uint8 minTier;
        bool enabled;
    }

    IERC20 public immutable bunkr;
    BunkrTickets public immutable deeds;
    address public oracle;

    struct Lock {
        address player;
        uint64 lockedAt;
        bool settled;
        uint256[] ids;
    }

    /// @notice Most Bags one run can carry (the Bunker Deed's loadout).
    uint256 public constant MAX_LOADOUT = 3;
    /// @notice After this, a player can take back Bags from a run nobody settled.
    uint256 public constant RECLAIM_AFTER = 7 days;

    /// @notice Token id = the Bag's index in the game's FORGE_ORDER list.
    mapping(uint256 => Recipe) public recipes;
    mapping(uint256 => Lock) private _locks;
    /// @notice Bags each player has locked in runs right now, per id.
    mapping(address => mapping(uint256 => uint256)) public lockedBalance;
    /// @notice Contracts or wallets allowed to award items without a recipe (season prizes).
    mapping(address => bool) public minters;

    event Forged(address indexed player, uint256 indexed bagId, uint256 burned);
    event LoadoutLocked(address indexed player, uint256 indexed runId, uint256[] ids);
    event RunSettled(address indexed player, uint256 indexed runId, uint256[] shattered, uint256[] returned);
    event Shattered(address indexed player, uint256 indexed bagId, uint256 indexed runId);
    event RecipeSet(uint256 indexed bagId, uint128 cost, uint8 minTier, bool enabled);
    event OracleChanged(address oracle);
    event MinterSet(address indexed minter, bool allowed);
    event Awarded(address indexed to, uint256 indexed id, uint256 amount, address indexed minter);
    /// @dev ERC-7572: tells marketplaces the collection metadata changed.
    event ContractURIUpdated();

    error UnknownBag();
    error TierTooLow(uint8 need, uint8 have);
    error NotOracle();
    error NotYourRun();
    error AlreadyLocked();
    error BadLoadout();
    error NoLock();
    error AlreadySettled();
    error NotInLoadout();
    error TooEarly();
    error NotMinter();

    /// @param base_ metadata base URL, ending in a slash: item `id` is at `<base_><id>.json`
    /// @param contractURI_ collection metadata (ERC-7572)
    constructor(
        IERC20 bunkr_,
        BunkrTickets deeds_,
        address owner_,
        address oracle_,
        string memory base_,
        string memory contractURI_
    ) ERC1155("") Ownable(owner_) {
        bunkr = bunkr_;
        deeds = deeds_;
        oracle = oracle_;
        _base = base_;
        _contractURI = contractURI_;
        _setDefaultRoyalty(owner_, 500); // 5% on marketplace sales, changeable
        emit OracleChanged(oracle_);
    }

    /// @notice Full metadata URL for one item.
    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(_base, Strings.toString(id), ".json");
    }

    /// @notice Collection metadata (name, description, image) for marketplaces.
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    function forge(uint256 bagId) external nonReentrant {
        _forge(bagId);
    }

    function forgeWithPermit(uint256 bagId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external nonReentrant {
        try IERC20Permit(address(bunkr)).permit(msg.sender, address(this), recipes[bagId].cost, deadline, v, r, s) {}
            catch {}
        _forge(bagId);
    }

    /// @notice Balances for a list of Bag ids, for one player.
    function bagsOf(address player, uint256[] calldata ids) external view returns (uint256[] memory out) {
        out = new uint256[](ids.length);
        for (uint256 i; i < ids.length; i++) out[i] = balanceOf(player, ids[i]);
    }

    /// @notice Carry Bags into a run you started: they move here until the run is settled.
    ///         One lock per run, up to MAX_LOADOUT different Bags, one of each.
    function lockLoadout(uint256 runId, uint256[] calldata ids) external nonReentrant {
        if (deeds.runPlayer(runId) != msg.sender) revert NotYourRun();
        Lock storage l = _locks[runId];
        if (l.player != address(0)) revert AlreadyLocked();
        if (ids.length == 0 || ids.length > MAX_LOADOUT) revert BadLoadout();
        uint256[] memory ones = new uint256[](ids.length);
        for (uint256 i; i < ids.length; i++) {
            for (uint256 j; j < i; j++) if (ids[j] == ids[i]) revert BadLoadout();
            ones[i] = 1;
            lockedBalance[msg.sender][ids[i]]++;
        }
        (l.player, l.lockedAt, l.ids) = (msg.sender, uint64(block.timestamp), ids);
        _update(msg.sender, address(this), ids, ones); // reverts if the player doesn't hold them
        emit LoadoutLocked(msg.sender, runId, ids);
    }

    /// @notice The results oracle closes a run: burn the Bags that shattered, return the rest.
    function settleRun(uint256 runId, uint256[] calldata shatterIds) external nonReentrant {
        if (msg.sender != oracle) revert NotOracle();
        Lock storage l = _locks[runId];
        uint256[] memory ids = l.ids;
        bool[] memory broken = new bool[](ids.length);
        for (uint256 i; i < shatterIds.length; i++) {
            uint256 k = _indexOf(ids, shatterIds[i]);
            if (broken[k]) revert BadLoadout();
            broken[k] = true;
        }
        _close(runId, broken);
    }

    /// @notice Take your Bags back from a run the oracle never settled.
    function reclaim(uint256 runId) external nonReentrant {
        Lock storage l = _locks[runId];
        if (l.player != msg.sender) revert NotYourRun();
        if (block.timestamp < l.lockedAt + RECLAIM_AFTER) revert TooEarly();
        _close(runId, new bool[](l.ids.length));
    }

    /// @notice A run's locked loadout: who locked it, when, whether it's settled, which Bags.
    function lockOf(uint256 runId) external view returns (address player, uint64 lockedAt, bool settled, uint256[] memory ids) {
        Lock storage l = _locks[runId];
        return (l.player, l.lockedAt, l.settled, l.ids);
    }

    /// @notice Award items outside the forge: season prizes, leaderboard trophies, event drops.
    function award(address to, uint256 id, uint256 amount) external {
        if (!minters[msg.sender]) revert NotMinter();
        _mint(to, id, amount, "");
        emit Awarded(to, id, amount, msg.sender);
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    /// @notice Marketplace royalty (ERC-2981), in basis points. 0 turns it off.
    function setRoyalty(address receiver, uint96 bps) external onlyOwner {
        if (bps == 0) _deleteDefaultRoyalty();
        else _setDefaultRoyalty(receiver, bps);
    }

    function setRecipes(uint256[] calldata ids, uint128[] calldata costs, uint8[] calldata minTiers) external onlyOwner {
        for (uint256 i; i < ids.length; i++) {
            recipes[ids[i]] = Recipe(costs[i], minTiers[i], true);
            emit RecipeSet(ids[i], costs[i], minTiers[i], true);
        }
    }

    function disableRecipe(uint256 id) external onlyOwner {
        recipes[id].enabled = false;
        emit RecipeSet(id, recipes[id].cost, recipes[id].minTier, false);
    }

    function setOracle(address oracle_) external onlyOwner {
        oracle = oracle_;
        emit OracleChanged(oracle_);
    }

    /// @notice Move the metadata (e.g. once the game has its real domain).
    function setMetadata(string calldata base_, string calldata contractURI_) external onlyOwner {
        _base = base_;
        _contractURI = contractURI_;
        emit ContractURIUpdated();
        emit URI(base_, type(uint256).max); // hint for indexers that all item URIs moved
    }

    function _close(uint256 runId, bool[] memory broken) internal {
        Lock storage l = _locks[runId];
        if (l.player == address(0)) revert NoLock();
        if (l.settled) revert AlreadySettled();
        l.settled = true;
        address player = l.player;
        uint256[] memory ids = l.ids;
        uint256 nb;
        for (uint256 i; i < ids.length; i++) if (broken[i]) nb++;
        uint256[] memory gone = new uint256[](nb);
        uint256[] memory back = new uint256[](ids.length - nb);
        (uint256 g, uint256 b) = (0, 0);
        for (uint256 i; i < ids.length; i++) {
            lockedBalance[player][ids[i]]--;
            if (broken[i]) gone[g++] = ids[i];
            else back[b++] = ids[i];
        }
        for (uint256 i; i < nb; i++) {
            _burn(address(this), gone[i], 1);
            emit Shattered(player, gone[i], runId);
        }
        if (back.length > 0) _update(address(this), player, back, _ones(back.length));
        emit RunSettled(player, runId, gone, back);
    }

    function _indexOf(uint256[] memory ids, uint256 id) internal pure returns (uint256) {
        for (uint256 i; i < ids.length; i++) if (ids[i] == id) return i;
        revert NotInLoadout();
    }

    function _ones(uint256 n) internal pure returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i; i < n; i++) out[i] = 1;
    }

    function _forge(uint256 bagId) internal {
        Recipe memory r = recipes[bagId];
        if (!r.enabled) revert UnknownBag();
        uint8 tier = deeds.tierOf(msg.sender);
        if (tier < r.minTier) revert TierTooLow(r.minTier, tier);
        bunkr.safeTransferFrom(msg.sender, DEAD, r.cost);
        _mint(msg.sender, bagId, 1, "");
        emit Forged(msg.sender, bagId, r.cost);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 id) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}

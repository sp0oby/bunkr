// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {BunkrTickets} from "./BunkrTickets.sol";

/// @title BunkrForge
/// @notice Forged Bags (ERC-1155). Forging burns $BUNKR and makes a Bag permanent, so you
///         can bring it into future runs or trade it. Rarer Bags need a higher Deed tier.
///         Get liquidated while carrying one and it can shatter: only the results oracle
///         can do that, once per run per Bag.
contract BunkrForge is ERC1155, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    struct Recipe {
        uint128 cost;
        uint8 minTier;
        bool enabled;
    }

    IERC20 public immutable bunkr;
    BunkrTickets public immutable deeds;
    address public oracle;

    /// @notice Token id = the Bag's index in the game's FORGE_ORDER list.
    mapping(uint256 => Recipe) public recipes;
    mapping(uint256 => mapping(uint256 => bool)) public shattered;

    event Forged(address indexed player, uint256 indexed bagId, uint256 burned);
    event Shattered(address indexed player, uint256 indexed bagId, uint256 indexed runId);
    event RecipeSet(uint256 indexed bagId, uint128 cost, uint8 minTier, bool enabled);
    event OracleChanged(address oracle);

    error UnknownBag();
    error TierTooLow(uint8 need, uint8 have);
    error NotOracle();
    error AlreadyShattered();

    constructor(IERC20 bunkr_, BunkrTickets deeds_, address owner_, address oracle_, string memory uri_)
        ERC1155(uri_)
        Ownable(owner_)
    {
        bunkr = bunkr_;
        deeds = deeds_;
        oracle = oracle_;
        emit OracleChanged(oracle_);
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

    /// @notice A carried Bag broke when its owner got liquidated.
    function shatter(address player, uint256 bagId, uint256 runId) external {
        if (msg.sender != oracle) revert NotOracle();
        if (shattered[runId][bagId]) revert AlreadyShattered();
        shattered[runId][bagId] = true;
        _burn(player, bagId, 1);
        emit Shattered(player, bagId, runId);
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

    function setURI(string calldata uri_) external onlyOwner {
        _setURI(uri_);
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
}

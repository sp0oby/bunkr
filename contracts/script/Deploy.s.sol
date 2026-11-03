// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockBUNKR} from "../src/MockBUNKR.sol";
import {BunkrTickets} from "../src/BunkrTickets.sol";
import {BunkrForge} from "../src/BunkrForge.sol";

/// Deploys the game contracts and writes their addresses to
/// src/chain/deployments/<chainId>.json for the game to import.
///
///   BUNKR_TOKEN  optional: the real $BUNKR address. Omit it to deploy MockBUNKR.
///   ORACLE       optional: results oracle. Defaults to the deployer (testnet only).
///   META_BASE    optional: where item metadata lives, e.g. https://bunkr.game/meta/
contract Deploy is Script {
    // Must match FORGE_ORDER in src/chain/forge.ts. 0 = common, 1 = rare, 2 = legendary.
    uint8[20] internal RARITY = [2, 1, 0, 1, 0, 1, 2, 0, 0, 1, 0, 0, 1, 0, 2, 1, 0, 2, 1, 0];

    function run() external {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        address token = vm.envOr("BUNKR_TOKEN", address(0));
        bool mock = token == address(0);
        if (mock) token = address(new MockBUNKR(deployer));
        address oracle = vm.envOr("ORACLE", deployer);

        uint256[4] memory thresholds = [uint256(10_000e18), 100_000e18, 1_000_000e18, 8_000_000e18];
        // Tickets: 2,500 (half burned, half to the Daily pot). Daily Doom: 10,000, 80% to the pot.
        BunkrTickets tickets = new BunkrTickets(IERC20(token), deployer, oracle, thresholds, 2_500e18, 5_000, 10_000e18, 8_000);
        // Item metadata is served by the game site: META_BASE is "<site>/meta/".
        string memory metaBase = vm.envOr("META_BASE", string("http://localhost:5173/meta/"));
        BunkrForge forge =
            new BunkrForge(IERC20(token), tickets, deployer, oracle, metaBase, string.concat(metaBase, "contract.json"));

        bagRecipes(forge);
        cosmeticRecipes(forge);
        vm.stopBroadcast();

        string memory o = "deploy";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeBool(o, "mock", mock);
        vm.serializeAddress(o, "bunkr", token);
        vm.serializeAddress(o, "tickets", address(tickets));
        vm.serializeUint(o, "block", block.number);
        string memory json = vm.serializeAddress(o, "forge", address(forge));
        string memory path = string.concat(vm.projectRoot(), "/../src/chain/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("BUNKR  ", token);
        console.log("Tickets", address(tickets));
        console.log("Forge  ", address(forge));
        console.log("Wrote  ", path);
    }

    function bagRecipes(BunkrForge forge) internal {
        uint256[] memory ids = new uint256[](20);
        uint128[] memory costs = new uint128[](20);
        uint8[] memory minTiers = new uint8[](20);
        uint128[3] memory COST = [uint128(5_000e18), 25_000e18, 100_000e18];
        for (uint256 i; i < 20; i++) {
            ids[i] = i;
            costs[i] = COST[RARITY[i]];
            minTiers[i] = RARITY[i] + 1; // common: Shed, rare: Basement, legendary: Bunker
        }
        forge.setRecipes(ids, costs, minTiers);
        forge.setFoundOnly(ids, true); // Bags must be found in a verified run before forging
    }

    /// Cosmetics (ids 100+, must match COSMETICS in src/chain/constants.ts). Shed tier.
    function cosmeticRecipes(BunkrForge forge) internal {
        uint256[] memory ids = new uint256[](4);
        uint128[] memory costs = new uint128[](4);
        uint8[] memory tiers = new uint8[](4);
        uint128[4] memory COST = [uint128(50_000e18), 50_000e18, 75_000e18, 30_000e18];
        for (uint256 i; i < 4; i++) {
            ids[i] = 100 + i;
            costs[i] = COST[i];
            tiers[i] = 1;
        }
        forge.setRecipes(ids, costs, tiers);
    }
}

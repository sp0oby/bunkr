// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockBUNKR} from "../src/MockBUNKR.sol";
import {BunkrTickets} from "../src/BunkrTickets.sol";
import {BunkrForge} from "../src/BunkrForge.sol";
import {BunkrStockForge} from "../src/BunkrStockForge.sol";
import {MockStock} from "../src/MockStock.sol";

/// Deploys the game contracts and writes their addresses to
/// src/chain/deployments/<chainId>.json for the game to import.
///
///   BUNKR_TOKEN  optional: the real $BUNKR address. Omit it to deploy MockBUNKR.
///   ORACLE       optional: results oracle. Defaults to the deployer (testnet only).
///   META_BASE    optional: where item metadata lives, e.g. https://bunkr.game/meta/
///   TREASURY     optional: where Stock Bag sales go. Defaults to the deployer (testnet only).
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
        BunkrStockForge stocks = stockBags(forge, tickets, deployer, oracle, mock);
        vm.stopBroadcast();

        string memory o = "deploy";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeBool(o, "mock", mock);
        vm.serializeAddress(o, "bunkr", token);
        vm.serializeAddress(o, "tickets", address(tickets));
        vm.serializeUint(o, "block", block.number);
        vm.serializeAddress(o, "stockForge", address(stocks));
        string memory json = vm.serializeAddress(o, "forge", address(forge));
        string memory path = string.concat(vm.projectRoot(), "/../src/chain/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("BUNKR  ", token);
        console.log("Tickets", address(tickets));
        console.log("Forge  ", address(forge));
        console.log("Stocks ", address(stocks));
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

    /// Stock Bags (ids 20+, must match FORGE_ORDER / STOCK_BAGS in the game). Legendary, never shatter.
    /// Testnet gets mock stocks with faucets. On mainnet they're the real Robinhood tokens, and the
    /// listings start switched off: set real prices with setListing before opening the shop.
    function stockBags(BunkrForge forge, BunkrTickets tickets, address deployer, address oracle, bool mock)
        internal
        returns (BunkrStockForge stocks)
    {
        address treasury = vm.envOr("TREASURY", deployer);
        stocks = new BunkrStockForge(forge, tickets, deployer, oracle, treasury, 2_000); // 20% to the Stonk Pot
        forge.setMinter(address(stocks), true);

        string[6] memory sym = ["PLTR", "NVDA", "AMC", "SPCX", "TSLA", "COST"];
        // Real Robinhood stock tokens (docs.robinhood.com/chain/contracts).
        address[6] memory real = [
            0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A,
            0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC,
            0x05a3d1Cd21d0C88145E82600E62e7E496e0F222B,
            0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa,
            0x322F0929c4625eD5bAd873c95208D54E1c003b2d,
            0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2
        ];
        // Shares per Bag (18 decimals). Testnet placeholders, tune before mainnet.
        uint128[6] memory price = [uint128(0.5e18), 0.5e18, 25e18, 0.5e18, 0.25e18, 0.1e18];
        uint256[] memory ids = new uint256[](6);
        for (uint256 i; i < 6; i++) {
            ids[i] = 20 + i;
            listStock(stocks, ids[i], sym[i], mock ? address(0) : real[i], price[i], mock);
        }
        forge.setUnbreakable(ids, true);
    }

    function listStock(BunkrStockForge stocks, uint256 id, string memory sym, address stock, uint128 price, bool mock)
        internal
    {
        if (stock == address(0)) stock = address(new MockStock(string.concat(sym, " (Testnet Stock)"), sym, uint256(price) * 3));
        stocks.setListing(id, IERC20(stock), price, 50_000e18, 500, 1, mock);
        console.log(sym, stock);
    }
}

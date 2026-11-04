// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockBUNKR} from "../src/MockBUNKR.sol";
import {MockStock} from "../src/MockStock.sol";
import {BunkrTickets} from "../src/BunkrTickets.sol";
import {BunkrForge} from "../src/BunkrForge.sol";
import {BunkrStockForge} from "../src/BunkrStockForge.sol";

contract StockForgeTest is Test {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 constant NVDA_BAG = 21;
    MockBUNKR token;
    MockStock nvda;
    MockStock pltr;
    BunkrTickets tickets;
    BunkrForge forge;
    BunkrStockForge stocks;
    address owner = makeAddr("owner");
    address oracle = makeAddr("oracle");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        vm.warp(400 days);
        token = new MockBUNKR(owner);
        uint256[4] memory th = [uint256(10_000e18), 100_000e18, 1_000_000e18, 8_000_000e18];
        tickets = new BunkrTickets(IERC20(address(token)), owner, oracle, th, 2_500e18, 5_000, 10_000e18, 8_000);
        forge = new BunkrForge(IERC20(address(token)), tickets, owner, oracle, "https://bunkr.test/meta/", "c");
        stocks = new BunkrStockForge(forge, tickets, owner, oracle, treasury, 2_000);
        nvda = new MockStock("NVDA (Testnet Stock)", "NVDA", 10e18);
        pltr = new MockStock("PLTR (Testnet Stock)", "PLTR", 10e18);
        uint256[] memory ids = new uint256[](2);
        (ids[0], ids[1]) = (20, NVDA_BAG);
        vm.startPrank(owner);
        forge.setMinter(address(stocks), true);
        forge.setUnbreakable(ids, true);
        stocks.setListing(20, IERC20(address(pltr)), 2e18, 50_000e18, 3, 1, true);
        stocks.setListing(NVDA_BAG, IERC20(address(nvda)), 1e18, 50_000e18, 2, 1, true);
        vm.stopPrank();
    }

    /// A player with a Shed Deed, stock from the faucet, and both allowances.
    function ready(address who) internal {
        vm.prank(owner);
        token.transfer(who, 200_000e18);
        vm.startPrank(who);
        nvda.faucet();
        pltr.faucet();
        token.approve(address(stocks), type(uint256).max);
        nvda.approve(address(stocks), type(uint256).max);
        pltr.approve(address(stocks), type(uint256).max);
        vm.stopPrank();
    }

    function test_buySplitsStockBurnsBunkrAndMints() public {
        ready(alice);
        uint256 deadBefore = token.balanceOf(DEAD);
        vm.prank(alice);
        stocks.buy(NVDA_BAG);
        assertEq(forge.balanceOf(alice, NVDA_BAG), 1);
        assertEq(token.balanceOf(DEAD) - deadBefore, 50_000e18, "BUNKR burned");
        assertEq(nvda.balanceOf(treasury), 0.8e18, "80% to the treasury");
        assertEq(nvda.balanceOf(address(stocks)), 0.2e18, "20% held for the pot");
        assertEq(stocks.stonkPot(stocks.week(), address(nvda)), 0.2e18);
        assertEq(nvda.balanceOf(alice), 9e18);
    }

    function test_capTierAndListingRules() public {
        ready(alice);
        ready(bob);
        vm.prank(alice);
        stocks.buy(NVDA_BAG);
        vm.prank(bob);
        stocks.buy(NVDA_BAG);
        vm.prank(alice);
        vm.expectRevert(BunkrStockForge.SoldOut.selector);
        stocks.buy(NVDA_BAG);

        // No Deed, no Stock Bag.
        vm.startPrank(carol);
        nvda.faucet();
        pltr.faucet();
        pltr.approve(address(stocks), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(BunkrStockForge.TierTooLow.selector, 1, 0));
        stocks.buy(20);
        vm.expectRevert(BunkrStockForge.NotListed.selector);
        stocks.buy(99);
        vm.stopPrank();

        // The owner can't shrink a cap below what's sold, or swap a Bag's stock.
        vm.startPrank(owner);
        vm.expectRevert(BunkrStockForge.BadConfig.selector);
        stocks.setListing(NVDA_BAG, IERC20(address(nvda)), 1e18, 0, 1, 1, true);
        vm.expectRevert(BunkrStockForge.BadConfig.selector);
        stocks.setListing(NVDA_BAG, IERC20(address(pltr)), 1e18, 0, 5, 1, true);
        stocks.setListing(NVDA_BAG, IERC20(address(nvda)), 1e18, 0, 5, 1, true); // more supply, free burn
        vm.stopPrank();
        vm.prank(alice);
        stocks.buy(NVDA_BAG);
        assertEq(forge.balanceOf(alice, NVDA_BAG), 2);

        // Strangers can't list, and can't mint through the Forge directly.
        vm.prank(alice);
        vm.expectRevert();
        stocks.setListing(30, IERC20(address(nvda)), 1, 0, 1, 1, true);
        vm.prank(alice);
        vm.expectRevert(BunkrForge.NotMinter.selector);
        forge.award(alice, NVDA_BAG, 1);
    }

    function test_stockBagsNeverShatter() public {
        ready(alice);
        vm.startPrank(alice);
        stocks.buy(NVDA_BAG);
        uint256 runId = tickets.enterRun(false, keccak256("s"));
        uint256[] memory ids = new uint256[](1);
        ids[0] = NVDA_BAG;
        forge.lockLoadout(runId, ids);
        vm.stopPrank();
        assertEq(forge.balanceOf(alice, NVDA_BAG), 0, "locked for the run");
        // Even if the oracle says it shattered, it goes home.
        vm.prank(oracle);
        forge.settleRun(runId, ids);
        assertEq(forge.balanceOf(alice, NVDA_BAG), 1);
        assertEq(forge.totalSupply(NVDA_BAG), 1);
    }

    function test_weeklyPotPaysTheLeaderboard() public {
        ready(alice);
        ready(bob);
        vm.prank(alice);
        stocks.buy(NVDA_BAG); // 0.2 NVDA to the pot
        vm.prank(bob);
        stocks.buy(20); // 0.4 PLTR to the pot
        uint256 wk = stocks.week();
        (address[] memory toks, uint256[] memory amts) = stocks.potOf(wk);
        assertEq(toks.length, 2);
        assertEq(amts[0] + amts[1], 0.6e18);

        address[] memory winners = new address[](3);
        (winners[0], winners[1], winners[2]) = (carol, bob, alice);
        uint16[] memory shares = new uint16[](3);
        (shares[0], shares[1], shares[2]) = (5_000, 3_000, 2_000);
        vm.prank(oracle);
        vm.expectRevert(BunkrStockForge.WeekNotOver.selector);
        stocks.settleWeek(wk, winners, shares);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        vm.expectRevert(BunkrStockForge.NotOracle.selector);
        stocks.settleWeek(wk, winners, shares);
        vm.prank(oracle);
        stocks.settleWeek(wk, winners, shares);
        assertEq(nvda.balanceOf(carol), 0.1e18, "1st: half the NVDA");
        assertEq(pltr.balanceOf(carol), 0.2e18, "1st: half the PLTR");
        assertEq(nvda.balanceOf(address(stocks)) + pltr.balanceOf(address(stocks)), 0, "pot emptied");
        vm.prank(oracle);
        vm.expectRevert(BunkrStockForge.AlreadySettled.selector);
        stocks.settleWeek(wk, winners, shares);
    }

    function test_emptyWeekRollsForwardAndAnyoneCanFund() public {
        ready(alice);
        vm.prank(alice);
        stocks.buy(NVDA_BAG);
        uint256 wk = stocks.week();
        // A sponsor tops up this week's pot.
        vm.startPrank(bob);
        nvda.faucet();
        nvda.approve(address(stocks), 1e18);
        stocks.fundPot(wk, IERC20(address(nvda)), 1e18);
        vm.stopPrank();
        assertEq(stocks.stonkPot(wk, address(nvda)), 1.2e18);

        vm.warp(block.timestamp + 7 days);
        vm.prank(oracle);
        stocks.rollWeek(wk);
        assertEq(stocks.stonkPot(wk, address(nvda)), 0);
        assertEq(stocks.stonkPot(stocks.week(), address(nvda)), 1.2e18);
        vm.prank(bob);
        vm.expectRevert(BunkrStockForge.WeekNotOver.selector);
        stocks.fundPot(wk, IERC20(address(nvda)), 1);
    }

    function test_potShareIsConfigurable() public {
        vm.prank(owner);
        stocks.setPotShare(0);
        ready(alice);
        vm.prank(alice);
        stocks.buy(NVDA_BAG);
        assertEq(nvda.balanceOf(treasury), 1e18, "treasury keeps it all");
        assertEq(stocks.stonkPot(stocks.week(), address(nvda)), 0);
        vm.prank(owner);
        vm.expectRevert(BunkrStockForge.BadConfig.selector);
        stocks.setPotShare(10_001);
    }
}

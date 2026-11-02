// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockBUNKR} from "../src/MockBUNKR.sol";
import {BunkrTickets} from "../src/BunkrTickets.sol";
import {BunkrForge} from "../src/BunkrForge.sol";

contract BunkrTest is Test {
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;
    MockBUNKR token;
    BunkrTickets tickets;
    BunkrForge forge;
    address owner = makeAddr("owner");
    address oracle = makeAddr("oracle");
    address alice;
    uint256 aliceKey;
    address bob = makeAddr("bob");

    function setUp() public {
        vm.warp(30 days);
        (alice, aliceKey) = makeAddrAndKey("alice");
        token = new MockBUNKR(owner);
        uint256[4] memory th = [uint256(10_000e18), 100_000e18, 1_000_000e18, 8_000_000e18];
        tickets = new BunkrTickets(IERC20(address(token)), owner, oracle, th, 2_500e18, 5_000);
        forge = new BunkrForge(IERC20(address(token)), tickets, owner, oracle, "");
        uint256[] memory ids = new uint256[](3);
        uint128[] memory costs = new uint128[](3);
        uint8[] memory tiers = new uint8[](3);
        (ids[0], costs[0], tiers[0]) = (0, 5_000e18, 1);
        (ids[1], costs[1], tiers[1]) = (1, 25_000e18, 2);
        (ids[2], costs[2], tiers[2]) = (2, 100_000e18, 3);
        vm.prank(owner);
        forge.setRecipes(ids, costs, tiers);
    }

    function fund(address who, uint256 amt) internal {
        vm.prank(owner);
        token.transfer(who, amt);
    }

    // ------------------------------------------------------------ token

    function test_supplyAndFaucet() public {
        assertEq(token.totalSupply(), 800_000_000e18);
        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 120_000e18);
        vm.prank(alice);
        vm.expectRevert();
        token.faucet();
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 240_000e18);
    }

    // ------------------------------------------------------------ deeds

    function test_tiers() public {
        assertEq(tickets.tierOf(alice), 0);
        fund(alice, 10_000e18);
        assertEq(tickets.tierOf(alice), 1);
        fund(alice, 90_000e18);
        assertEq(tickets.tierOf(alice), 2);
        fund(alice, 900_000e18);
        assertEq(tickets.tierOf(alice), 3);
        fund(alice, 7_000_000e18);
        assertEq(tickets.tierOf(alice), 4);
        // Sell below a tier: foreclosed.
        vm.prank(alice);
        token.transfer(bob, 7_999_000e18);
        assertEq(tickets.tierOf(alice), 0);
    }

    // ------------------------------------------------------------ tickets

    function test_noDeedNoEntry() public {
        vm.prank(alice);
        vm.expectRevert(BunkrTickets.NoDeed.selector);
        tickets.enterRun(false);
    }

    function test_freeTicketOncePerDay() public {
        fund(alice, 10_000e18);
        assertTrue(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        assertEq(tickets.enterRun(false), 1);
        assertFalse(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        vm.expectRevert(BunkrTickets.NoTicket.selector);
        tickets.enterRun(false);
        vm.warp(block.timestamp + 1 days);
        assertTrue(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        tickets.enterRun(true);
    }

    function test_buySplitsBurnAndPot() public {
        fund(alice, 20_000e18);
        vm.startPrank(alice);
        token.approve(address(tickets), type(uint256).max);
        tickets.buyTickets(2);
        vm.stopPrank();
        assertEq(tickets.tickets(alice), 2);
        assertEq(token.balanceOf(DEAD), 2_500e18);
        assertEq(tickets.pot(tickets.today()), 2_500e18);
        assertEq(token.balanceOf(address(tickets)), 2_500e18);
        // Free one first, then bought ones.
        vm.startPrank(alice);
        tickets.enterRun(false);
        tickets.enterRun(false);
        vm.stopPrank();
        assertEq(tickets.tickets(alice), 1);
    }

    function test_buyWithPermit() public {
        fund(alice, 20_000e18);
        uint256 cost = 3 * 2_500e18;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        alice,
                        address(tickets),
                        cost,
                        token.nonces(alice),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);
        vm.prank(alice);
        tickets.buyTicketsWithPermit(3, deadline, v, r, s);
        assertEq(tickets.tickets(alice), 3);
    }

    function test_settleDay() public {
        fund(alice, 20_000e18);
        vm.startPrank(alice);
        token.approve(address(tickets), type(uint256).max);
        tickets.buyTickets(4); // 5,000 to the pot
        vm.stopPrank();
        uint256 day = tickets.today();
        address[] memory w = new address[](2);
        uint16[] memory s = new uint16[](2);
        (w[0], s[0]) = (bob, 7_000);
        (w[1], s[1]) = (alice, 3_000);

        vm.prank(oracle);
        vm.expectRevert(BunkrTickets.DayNotOver.selector);
        tickets.settleDay(day, w, s);

        vm.warp(block.timestamp + 1 days);
        vm.prank(bob);
        vm.expectRevert(BunkrTickets.NotOracle.selector);
        tickets.settleDay(day, w, s);

        vm.prank(oracle);
        tickets.settleDay(day, w, s);
        assertEq(token.balanceOf(bob), 3_500e18);
        assertEq(tickets.pot(day), 0);
        vm.prank(oracle);
        vm.expectRevert(BunkrTickets.AlreadySettled.selector);
        tickets.settleDay(day, w, s);
    }

    function test_rollDay() public {
        fund(alice, 20_000e18);
        vm.startPrank(alice);
        token.approve(address(tickets), type(uint256).max);
        tickets.buyTickets(2);
        vm.stopPrank();
        uint256 day = tickets.today();
        vm.warp(block.timestamp + 1 days);
        vm.prank(oracle);
        tickets.rollDay(day);
        assertEq(tickets.pot(day + 1), 2_500e18);
    }

    function test_badConfigRejected() public {
        uint256[4] memory th = [uint256(10), 5, 20, 30];
        vm.prank(owner);
        vm.expectRevert(BunkrTickets.BadConfig.selector);
        tickets.setConfig(th, 1, 100);
    }

    // ------------------------------------------------------------ forge

    function test_forgeBurnsAndMints() public {
        fund(alice, 30_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        forge.forge(0);
        vm.stopPrank();
        assertEq(forge.balanceOf(alice, 0), 1);
        assertEq(token.balanceOf(DEAD), 5_000e18);
    }

    function test_forgeTierGate() public {
        fund(alice, 30_000e18); // Shed only
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(BunkrForge.TierTooLow.selector, 2, 1));
        forge.forge(1);
        vm.expectRevert(BunkrForge.UnknownBag.selector);
        forge.forge(7);
        vm.stopPrank();
    }

    function test_shatterOnlyOracleOncePerRun() public {
        fund(alice, 30_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        forge.forge(0);
        forge.forge(0);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(BunkrForge.NotOracle.selector);
        forge.shatter(alice, 0, 1);

        vm.prank(oracle);
        forge.shatter(alice, 0, 1);
        assertEq(forge.balanceOf(alice, 0), 1);
        vm.prank(oracle);
        vm.expectRevert(BunkrForge.AlreadyShattered.selector);
        forge.shatter(alice, 0, 1);
    }

    function test_bagsAreTradeable() public {
        fund(alice, 30_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        forge.forge(0);
        forge.safeTransferFrom(alice, bob, 0, 1, "");
        vm.stopPrank();
        assertEq(forge.balanceOf(bob, 0), 1);
    }
}

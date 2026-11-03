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
    uint256 oracleKey = 0xA11CE0;
    address oracle = vm.addr(0xA11CE0);
    address alice;
    uint256 aliceKey;
    address bob = makeAddr("bob");

    function setUp() public {
        vm.warp(30 days);
        (alice, aliceKey) = makeAddrAndKey("alice");
        token = new MockBUNKR(owner);
        uint256[4] memory th = [uint256(10_000e18), 100_000e18, 1_000_000e18, 8_000_000e18];
        tickets = new BunkrTickets(IERC20(address(token)), owner, oracle, th, 2_500e18, 5_000, 10_000e18, 8_000);
        forge = new BunkrForge(IERC20(address(token)), tickets, owner, oracle, "https://bunkr.test/meta/", "https://bunkr.test/meta/contract.json");
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
        tickets.enterRun(false, bytes32(0));
    }

    function test_freeTicketOncePerDay() public {
        fund(alice, 10_000e18);
        assertTrue(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        assertEq(tickets.enterRun(false, bytes32(0)), 1);
        assertFalse(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        vm.expectRevert(BunkrTickets.NoTicket.selector);
        tickets.enterRun(false, bytes32(0));
        vm.warp(block.timestamp + 1 days);
        assertTrue(tickets.freeTicketAvailable(alice));
        vm.prank(alice);
        tickets.enterRun(false, bytes32(0));
    }

    function test_dailyOncePerDayAndCommitEmitted() public {
        fund(alice, 60_000e18);
        vm.startPrank(alice);
        token.approve(address(tickets), type(uint256).max);
        tickets.buyTickets(2);
        bytes32 commit = keccak256("secret");
        vm.expectEmit(true, true, true, true);
        emit BunkrTickets.RunEntered(alice, 1, tickets.today(), true, false, 1, commit);
        tickets.enterRun(true, commit);
        assertFalse(tickets.dailyAvailable(alice));
        vm.expectRevert(BunkrTickets.DailyAlreadyPlayed.selector);
        tickets.enterRun(true, commit);
        tickets.enterRun(false, commit); // normal runs are still fine
        vm.warp(block.timestamp + 1 days);
        tickets.enterRun(true, commit);
        vm.stopPrank();
    }

    function test_dailyFeeFillsThePot() public {
        fund(alice, 30_000e18);
        fund(bob, 30_000e18);
        uint256 day = tickets.today();
        for (uint256 i; i < 2; i++) {
            address p = i == 0 ? alice : bob;
            vm.startPrank(p);
            token.approve(address(tickets), type(uint256).max);
            tickets.enterRun(true, bytes32(0));
            vm.stopPrank();
        }
        // 80% of each 10,000 entry to the pot, 20% burned; free tickets untouched.
        assertEq(tickets.pot(day), 16_000e18);
        assertEq(token.balanceOf(DEAD), 4_000e18);
        assertTrue(tickets.freeTicketAvailable(alice));
    }

    function test_dailyNeedsTheFee() public {
        fund(alice, 12_000e18); // a Shed Deed, and a free ticket, but no allowance for the fee
        vm.prank(alice);
        vm.expectRevert();
        tickets.enterRun(true, bytes32(0));
        assertTrue(tickets.dailyAvailable(alice)); // the failed attempt doesn't use up today's try
    }

    function test_dailyWithPermit() public {
        fund(alice, 20_000e18);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                token.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        alice, address(tickets), 10_000e18, token.nonces(alice), deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);
        vm.prank(alice);
        tickets.enterDailyWithPermit(bytes32(0), deadline, v, r, s);
        assertEq(tickets.pot(tickets.today()), 8_000e18);
    }

    function test_fundPot() public {
        fund(bob, 50_000e18);
        uint256 day = tickets.today();
        vm.startPrank(bob);
        token.approve(address(tickets), type(uint256).max);
        tickets.fundPot(day, 50_000e18);
        vm.expectRevert(BunkrTickets.DayNotOver.selector);
        tickets.fundPot(day - 1, 1);
        vm.stopPrank();
        assertEq(tickets.pot(day), 50_000e18);
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
        tickets.enterRun(false, bytes32(0));
        tickets.enterRun(false, bytes32(0));
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

    /// alice forges Bags 0 and 1 (Basement Deed), starts a run, and returns its id.
    function aliceRunWithBags() internal returns (uint256 runId) {
        fund(alice, 150_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        forge.forge(0);
        forge.forge(0);
        forge.forge(1);
        runId = tickets.enterRun(false, keccak256("s"));
        vm.stopPrank();
    }

    function ids2(uint256 a, uint256 b) internal pure returns (uint256[] memory out) {
        out = new uint256[](2);
        (out[0], out[1]) = (a, b);
    }

    function test_loadoutIsHeldDuringRun() public {
        uint256 runId = aliceRunWithBags();
        assertEq(tickets.runPlayer(runId), alice);

        // Only the run's player can lock, only Bags they hold, no repeats, once per run.
        vm.prank(bob);
        vm.expectRevert(BunkrForge.NotYourRun.selector);
        forge.lockLoadout(runId, ids2(0, 1));
        vm.startPrank(alice);
        vm.expectRevert(BunkrForge.BadLoadout.selector);
        forge.lockLoadout(runId, ids2(0, 0));
        vm.expectRevert();
        forge.lockLoadout(runId, ids2(0, 2)); // never forged Bag 2
        forge.lockLoadout(runId, ids2(0, 1));
        vm.expectRevert(BunkrForge.AlreadyLocked.selector);
        forge.lockLoadout(runId, ids2(0, 1));

        // Mid-run the carried copies are gone from the wallet: can't dodge the stakes.
        assertEq(forge.balanceOf(alice, 0), 1);
        assertEq(forge.balanceOf(alice, 1), 0);
        assertEq(forge.balanceOf(address(forge), 1), 1);
        assertEq(forge.lockedBalance(alice, 1), 1);
        vm.expectRevert();
        forge.safeTransferFrom(alice, bob, 1, 1, "");
        vm.stopPrank();

        // Lost run: the oracle shatters Bag 1, Bag 0 comes home.
        vm.prank(alice);
        vm.expectRevert(BunkrForge.NotOracle.selector);
        forge.settleRun(runId, new uint256[](0));
        uint256[] memory gone = new uint256[](1);
        gone[0] = 1;
        vm.prank(oracle);
        forge.settleRun(runId, gone);
        assertEq(forge.balanceOf(alice, 0), 2);
        assertEq(forge.balanceOf(alice, 1), 0);
        assertEq(forge.totalSupply(1), 0);
        assertEq(forge.lockedBalance(alice, 1), 0);
        vm.prank(oracle);
        vm.expectRevert(BunkrForge.AlreadySettled.selector);
        forge.settleRun(runId, new uint256[](0));
    }

    function test_settleReturnsAllOnWinAndRejectsStrangers() public {
        uint256 runId = aliceRunWithBags();
        vm.prank(alice);
        forge.lockLoadout(runId, ids2(0, 1));
        uint256[] memory stranger = new uint256[](1);
        stranger[0] = 5;
        vm.prank(oracle);
        vm.expectRevert(BunkrForge.NotInLoadout.selector);
        forge.settleRun(runId, stranger);
        vm.prank(oracle);
        forge.settleRun(runId, new uint256[](0)); // survived
        assertEq(forge.balanceOf(alice, 0), 2);
        assertEq(forge.balanceOf(alice, 1), 1);
        vm.prank(oracle);
        vm.expectRevert(BunkrForge.NoLock.selector);
        forge.settleRun(999, new uint256[](0));
    }

    function test_reclaimAfterAWeekIfNeverSettled() public {
        uint256 runId = aliceRunWithBags();
        vm.startPrank(alice);
        forge.lockLoadout(runId, ids2(0, 1));
        vm.expectRevert(BunkrForge.TooEarly.selector);
        forge.reclaim(runId);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert(BunkrForge.NotYourRun.selector);
        forge.reclaim(runId);
        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        forge.reclaim(runId);
        assertEq(forge.balanceOf(alice, 1), 1);
        vm.prank(oracle);
        vm.expectRevert(BunkrForge.AlreadySettled.selector);
        forge.settleRun(runId, new uint256[](0));
    }

    function test_metadata() public {
        assertEq(forge.name(), "BUNKR Forge");
        assertEq(forge.symbol(), "BKRF");
        assertEq(forge.uri(5), "https://bunkr.test/meta/5.json");
        assertEq(forge.uri(103), "https://bunkr.test/meta/103.json");
        assertEq(forge.contractURI(), "https://bunkr.test/meta/contract.json");
        assertTrue(forge.supportsInterface(0xd9b67a26)); // ERC-1155
        assertTrue(forge.supportsInterface(0x0e89341c)); // ERC-1155 metadata URI
        vm.prank(bob);
        vm.expectRevert();
        forge.setMetadata("x", "y");
        vm.prank(owner);
        forge.setMetadata("https://bunkr.game/meta/", "https://bunkr.game/meta/contract.json");
        assertEq(forge.uri(0), "https://bunkr.game/meta/0.json");
    }

    function test_growsWithoutRedeploy() public {
        // New item: just a new recipe id.
        uint256[] memory ids = new uint256[](1);
        uint128[] memory costs = new uint128[](1);
        uint8[] memory tiers = new uint8[](1);
        (ids[0], costs[0], tiers[0]) = (500, 1_000e18, 0);
        vm.prank(owner);
        forge.setRecipes(ids, costs, tiers);
        fund(alice, 1_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        forge.forge(500);
        vm.stopPrank();
        assertEq(forge.totalSupply(500), 1);

        // Season prizes: only approved minters can award.
        address season = makeAddr("season");
        vm.prank(season);
        vm.expectRevert(BunkrForge.NotMinter.selector);
        forge.award(bob, 9000, 1);
        vm.prank(bob);
        vm.expectRevert();
        forge.setMinter(season, true);
        vm.prank(owner);
        forge.setMinter(season, true);
        vm.prank(season);
        forge.award(bob, 9000, 3);
        assertEq(forge.balanceOf(bob, 9000), 3);

        // Holders burn their own; an approved contract can burn for them (e.g. a season entry fee).
        vm.prank(bob);
        forge.burn(bob, 9000, 1);
        vm.prank(alice);
        vm.expectRevert();
        forge.burn(bob, 9000, 1);
        vm.prank(bob);
        forge.setApprovalForAll(season, true);
        vm.prank(season);
        forge.burn(bob, 9000, 1);
        assertEq(forge.totalSupply(9000), 1);

        // Royalties: 5% to the owner by default, owner can change or turn off.
        (address to, uint256 cut) = forge.royaltyInfo(0, 1 ether);
        assertEq(to, owner);
        assertEq(cut, 0.05 ether);
        assertTrue(forge.supportsInterface(0x2a55205a)); // ERC-2981
        vm.prank(owner);
        forge.setRoyalty(bob, 0);
        (, cut) = forge.royaltyInfo(0, 1 ether);
        assertEq(cut, 0);
    }

    function voucher(uint256 key, address player, uint256 bagId, uint256 runId) internal view returns (bytes memory) {
        bytes32 d = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", forge.voucherDigest(player, bagId, runId)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, d);
        return abi.encodePacked(r, s, v);
    }

    function test_foundBagsNeedAVoucher() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;
        vm.prank(bob);
        vm.expectRevert();
        forge.setFoundOnly(ids, true);
        vm.prank(owner);
        forge.setFoundOnly(ids, true);
        fund(alice, 30_000e18);
        vm.startPrank(alice);
        token.approve(address(forge), type(uint256).max);
        vm.expectRevert(BunkrForge.NeedsVoucher.selector);
        forge.forge(0);
        // Someone else's key, someone else's voucher, the wrong Bag: all refused.
        (, uint256 strangerKey) = makeAddrAndKey("stranger");
        bytes memory real = voucher(oracleKey, alice, 0, 7);
        bytes memory fake = voucher(strangerKey, alice, 0, 7);
        bytes memory bobs = voucher(oracleKey, bob, 0, 7);
        bytes memory next = voucher(oracleKey, alice, 0, 8);
        vm.expectRevert(BunkrForge.BadVoucher.selector);
        forge.forgeFound(0, 7, fake);
        vm.expectRevert(BunkrForge.BadVoucher.selector);
        forge.forgeFound(0, 7, bobs);
        vm.expectRevert(BunkrForge.BadVoucher.selector);
        forge.forgeFound(1, 7, real);
        // The real one works once.
        forge.forgeFound(0, 7, real);
        assertEq(forge.balanceOf(alice, 0), 1);
        vm.expectRevert(BunkrForge.VoucherUsed.selector);
        forge.forgeFound(0, 7, real);
        // A Bag found in another run is another voucher.
        forge.forgeFound(0, 8, next);
        assertEq(forge.balanceOf(alice, 0), 2);
        vm.stopPrank();
        // Repricing keeps the flag.
        uint128[] memory costs = new uint128[](1);
        uint8[] memory tiers = new uint8[](1);
        (costs[0], tiers[0]) = (6_000e18, 1);
        vm.prank(owner);
        forge.setRecipes(ids, costs, tiers);
        (,,, bool foundOnly) = forge.recipes(0);
        assertTrue(foundOnly);
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

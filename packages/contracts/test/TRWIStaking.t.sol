// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { REBAZ } from "../src/REBAZ.sol";
import { TRWI } from "../src/TRWI.sol";
import { TRWIStaking } from "../src/TRWIStaking.sol";
import { MockEAS } from "./mocks/MockEAS.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@ethereum-attestation-service/eas-contracts/Common.sol";

contract TRWIStakingTest is Test {
    REBAZ internal rebaz;
    TRWI internal trwi;
    TRWIStaking internal staking;
    MockEAS internal eas;

    address internal ngo = makeAddr("ngo");
    address internal alice = makeAddr("alice");

    bytes32 internal constant SCHEMA = keccak256("ImpactClaim");
    bytes32 internal constant UID1 = bytes32(uint256(0x1));

    event RewardRateChanged(uint256 bps);

    function setUp() public {
        // admin = this test contract → can grant roles without prank gymnastics
        eas = new MockEAS();
        rebaz = new REBAZ(address(this), address(this), 0, 1_000_000_000_000 ether);

        TRWI impl = new TRWI();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl), abi.encodeCall(TRWI.initialize, (address(this), address(eas), SCHEMA))
        );
        trwi = TRWI(address(proxy));

        staking = new TRWIStaking(address(this), address(trwi), address(rebaz), 1000); // 10%/yr base

        rebaz.grantRole(rebaz.MINTER_ROLE(), address(staking));
        trwi.grantRole(trwi.MINTER_ROLE(), address(this));

        // mint 100 editions of impact id 1 (totalIV 1000) to the NGO
        eas.set(
            Attestation({
                uid: UID1,
                schema: SCHEMA,
                time: 0,
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: ngo,
                attester: address(0xBEEF),
                revocable: true,
                data: abi.encode(ngo, uint256(1000 ether), "ipfs://m")
            })
        );
        trwi.mint(
            TRWI.MintParams({
                tokenId: 1,
                creator: ngo,
                totalIV: 1000 ether,
                maxEditions: 100,
                easUID: UID1,
                metadataURI: "ipfs://m",
                royaltyBps: 0
            }),
            ngo,
            100
        );

        vm.prank(ngo);
        trwi.setApprovalForAll(address(staking), true);
    }

    function test_SetBaseRewardRate_EmitsEvent() public {
        vm.expectEmit(false, false, false, true, address(staking));
        emit RewardRateChanged(2000);
        staking.setBaseRewardRate(2000); // admin = this test contract
        assertEq(staking.baseRewardRateBps(), 2000);
    }

    function test_StakeAccrueClaim() public {
        // stake 50 editions (IV 500) for 90 days → 1.5x multiplier
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 90 days);

        assertEq(trwi.balanceOf(ngo, 1), 50);
        assertEq(trwi.balanceOf(address(staking), 1), 50);

        (,,, uint256 ivStaked,,,, uint32 mult) = staking.stakes(sid);
        assertEq(ivStaked, 500 ether);
        assertEq(mult, 15_000);

        vm.warp(block.timestamp + 365 days);
        // reward = 500 * 10% * 1.5 = 75 REBAZ/yr
        assertEq(staking.pendingReward(sid), 75 ether);

        vm.prank(ngo);
        uint256 reward = staking.claim(sid);
        assertEq(reward, 75 ether);
        assertEq(rebaz.balanceOf(ngo), 75 ether);
        assertEq(staking.pendingReward(sid), 0); // reset after claim
    }

    function test_UnstakeAfterLock() public {
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 30 days);

        vm.warp(block.timestamp + 30 days);
        vm.prank(ngo);
        staking.unstake(sid);

        assertEq(trwi.balanceOf(ngo, 1), 100); // editions returned
        assertEq(trwi.balanceOf(address(staking), 1), 0);
        assertGt(rebaz.balanceOf(ngo), 0); // some reward minted
    }

    function test_Revert_UnstakeWhileLocked() public {
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 30 days);
        vm.warp(block.timestamp + 10 days);
        vm.prank(ngo);
        vm.expectRevert(TRWIStaking.StillLocked.selector);
        staking.unstake(sid);
    }

    function test_Revert_BadLock() public {
        vm.prank(ngo);
        vm.expectRevert(TRWIStaking.BadLock.selector);
        staking.stake(1, 50, 10 days);
    }

    function test_Revert_NonOwnerClaim() public {
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 0);
        vm.prank(alice);
        vm.expectRevert(TRWIStaking.NotStakeOwner.selector);
        staking.claim(sid);
    }

    function test_Multipliers() public view {
        assertEq(staking.multiplierFor(0), 10_000);
        assertEq(staking.multiplierFor(30 days), 12_000);
        assertEq(staking.multiplierFor(90 days), 15_000);
        assertEq(staking.multiplierFor(180 days), 20_000);
        assertEq(staking.multiplierFor(365 days), 30_000);
    }

    // --- hardening: reward accounting, emergency exit, pause ---

    /// M1: a rate change must NOT reprice already-elapsed time.
    function test_RateChange_NotRetroactive() public {
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 100, 0); // IV 1000, 1x
        vm.warp(block.timestamp + 365 days);
        staking.setBaseRewardRate(2000); // 10% -> 20%
        // the elapsed year stays at 10% = 100 REBAZ (NOT 200)
        assertEq(staking.pendingReward(sid), 100 ether);
        vm.warp(block.timestamp + 365 days); // +1yr @ 20% = +200
        assertEq(staking.pendingReward(sid), 300 ether);
    }

    /// M1: per-stake APR is not pool-diluted; a later staker doesn't change an earlier one's accrual.
    function test_TwoStakers_StaggeredNotDiluted() public {
        vm.prank(ngo);
        trwi.safeTransferFrom(ngo, alice, 1, 40, "");
        vm.prank(alice);
        trwi.setApprovalForAll(address(staking), true);

        vm.prank(ngo);
        uint256 s1 = staking.stake(1, 60, 0); // IV 600
        vm.warp(block.timestamp + 365 days);
        vm.prank(alice);
        uint256 s2 = staking.stake(1, 40, 0); // IV 400, joins after 1yr
        vm.warp(block.timestamp + 365 days);

        assertEq(staking.pendingReward(s1), 120 ether); // 2yr @10% on 600
        assertEq(staking.pendingReward(s2), 40 ether); // 1yr @10% on 400
    }

    /// H2: principal is recoverable even if reward minting is broken (MINTER_ROLE revoked).
    function test_EmergencyUnstake_AfterMinterRevoked() public {
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 0);
        vm.warp(block.timestamp + 365 days);

        rebaz.revokeRole(rebaz.MINTER_ROLE(), address(staking)); // minting now reverts

        vm.prank(ngo);
        vm.expectRevert(); // normal unstake reverts on the failed reward mint
        staking.unstake(sid);

        vm.prank(ngo);
        staking.emergencyUnstake(sid); // principal exit always works
        assertEq(trwi.balanceOf(ngo, 1), 100);
        assertEq(rebaz.balanceOf(ngo), 0); // rewards forfeited
        assertEq(staking.userStakes(ngo).length, 0); // pruned
    }

    /// M4: pause blocks entry (stake) but principal exit (emergencyUnstake) still works.
    function test_Paused_BlocksEntry_AllowsExit() public {
        staking.grantRole(staking.PAUSER_ROLE(), address(this));
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 0);

        staking.pause();
        vm.prank(ngo);
        vm.expectRevert(); // EnforcedPause
        staking.stake(1, 10, 0);

        vm.prank(ngo);
        staking.emergencyUnstake(sid);
        assertEq(trwi.balanceOf(ngo, 1), 100);
    }

    /// M4: a pause lets a locked stake exit early (the pause itself is the emergency).
    function test_EmergencyUnstake_BypassesLockWhenPaused() public {
        staking.grantRole(staking.PAUSER_ROLE(), address(this));
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 365 days); // long lock

        // not paused: locked stake cannot emergency-exit
        vm.prank(ngo);
        vm.expectRevert(TRWIStaking.StillLocked.selector);
        staking.emergencyUnstake(sid);

        staking.pause();
        vm.prank(ngo);
        staking.emergencyUnstake(sid); // now allowed despite the lock
        assertEq(trwi.balanceOf(ngo, 1), 100);
    }
}

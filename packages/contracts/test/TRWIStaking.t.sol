// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {REBAZ} from "../src/REBAZ.sol";
import {TRWI} from "../src/TRWI.sol";
import {TRWIStaking} from "../src/TRWIStaking.sol";
import {MockEAS} from "./mocks/MockEAS.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Attestation} from "@ethereum-attestation-service/eas-contracts/Common.sol";

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
        rebaz = new REBAZ(address(this), address(this), 0);

        TRWI impl = new TRWI();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(TRWI.initialize, (address(this), address(eas), SCHEMA)));
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
}

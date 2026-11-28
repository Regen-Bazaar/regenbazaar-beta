// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Revision4Base } from "./Revision4Base.sol";
import { TRWIV4 } from "../../src/revision4/TRWIV4.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";

contract TRWIV4Test is Revision4Base {
    // ---- item 4 + 5: new attestation format, `creator` field, facts copied at first sale ----

    function test_Register_CopiesAttestationFacts() public {
        bytes32 uid = _issue(1, partner, 3);
        TRWIV4.Collection memory c = trwi.collection(1);
        assertEq(c.creator, creator);
        assertEq(c.totalIV, IV);
        assertEq(c.maxEditions, EDITIONS);
        assertEq(c.minted, 3);
        assertEq(c.easUID, uid);
        assertEq(c.partner, partner);
        assertEq(c.validator, validator);
        assertEq(c.proofLevel, 2);
        assertEq(c.methodologyVersion, METHOD);
        assertTrue(c.transferable);
        assertEq(c.royaltyBps, 250);
        assertEq(c.resaleFeeBps, 250);
        assertEq(c.resalePartnerBps, 250);
        assertEq(trwi.uri(1), URI);
        assertEq(trwi.tokenIdForUID(uid), 1);
        (address r, uint256 a) = trwi.royaltyInfo(1, 10_000);
        assertEq(r, creator);
        assertEq(a, 250);
    }

    function test_DecodeClaim_ReadsAllEightFields() public view {
        TRWIV4.Claim memory cl = trwi.decodeClaim(_claim(partner, false));
        assertEq(cl.creator, creator);
        assertEq(cl.impactValue, IV);
        assertEq(cl.metadataURI, URI);
        assertEq(cl.proofLevel, 2);
        assertEq(cl.methodologyVersion, METHOD);
        assertEq(cl.validator, validator);
        assertEq(cl.partner, partner);
        assertFalse(cl.transferable);
    }

    function test_Register_RevertsOnCreatorMismatch() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.creator = stranger;
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
    }

    function test_Register_RevertsOnIVMismatch() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.totalIV = IV + 1;
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
    }

    function test_Register_RevertsOnURIMismatch() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.metadataURI = "ipfs://other";
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
    }

    /// Partner is fixed by the attestation: a voucher cannot add, drop or swap it.
    function test_Register_RevertsWhenVoucherPartnerDiffersFromAttestation() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, stranger, 500);
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
        v = _voucher(1, uid, address(0), 0);
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
    }

    function test_LaterMint_RevertsWhenPartnerChanges() public {
        _issue(1, address(0), 1);
        bytes32 uid = trwi.collection(1).easUID;
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        _expectRedeemRevert(v, TRWIV4.Mismatch.selector);
    }

    function test_Register_RevertsOnProofLevelAboveP4() public {
        bytes32 uid = _attestData(abi.encode(creator, IV, URI, uint8(5), METHOD, validator, address(0), true));
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), TRWIV4.BadParams.selector);
    }

    function test_Register_AcceptsUnrecordedValidatorAndUngradedProof() public {
        bytes32 uid = _attestData(abi.encode(creator, IV, URI, uint8(0), "v0.1", address(0), address(0), true));
        _redeem(buyer, _voucher(1, uid, address(0), 0), 1);
        assertEq(trwi.collection(1).validator, address(0));
        assertEq(trwi.collection(1).proofLevel, 0);
    }

    function test_Register_RevertsOnUnknownUID() public {
        _expectRedeemRevert(_voucher(1, bytes32(uint256(123)), address(0), 0), TRWIV4.UID_Unknown.selector);
    }

    function test_Register_RevertsOnUIDReusedForSecondToken() public {
        bytes32 uid = _issue(1, address(0), 1);
        _expectRedeemRevert(_voucher(2, uid, address(0), 0), TRWIV4.UID_AlreadyUsed.selector);
    }

    function test_Register_RevertsOnExpiredAttestation() public {
        bytes32 uid = _attestData(_claim(address(0), true), uint64(block.timestamp + 10));
        vm.warp(block.timestamp + 11);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        _expectRedeemRevert(v, TRWIV4.UID_Expired.selector);
    }

    function test_Mint_RevertsAboveMaxEditions() public {
        bytes32 uid = _issue(1, address(0), 99);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.mintCap = 1000; // the token's own maximum still holds above any voucher cap
        _expectRedeemRevertAmount(v, 2, TRWIV4.ExceedsMax.selector);
    }

    function test_Mint_OnlyMinter() public {
        TRWIV4.MintParams memory p;
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, admin, trwi.MINTER_ROLE()
            )
        );
        vm.prank(admin);
        trwi.mint(p, buyer, 1);
    }

    // ---- resale share caps, fixed per impact ----

    function test_Register_RevertsWhenRoyaltyAboveCap() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.royaltyBps = 1001;
        _expectRedeemRevert(v, TRWIV4.RoyaltyTooHigh.selector);
    }

    function test_Register_RevertsWhenResaleFeeAboveCap() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.resaleFeeBps = 1001;
        _expectRedeemRevert(v, TRWIV4.SharesTooHigh.selector);
    }

    function test_Register_RevertsWhenResalePartnerAboveCap() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        v.resalePartnerBps = 1001;
        _expectRedeemRevert(v, TRWIV4.SharesTooHigh.selector);
    }

    function test_Register_RevertsWhenCombinedResaleSharesAboveCap() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        v.royaltyBps = 500;
        v.resaleFeeBps = 500;
        v.resalePartnerBps = 501; // 1501 > 1500
        _expectRedeemRevert(v, TRWIV4.SharesTooHigh.selector);
        v.resalePartnerBps = 500; // exactly 1500 is allowed
        _redeem(buyer, v, 1);
        assertEq(trwi.collection(1).resalePartnerBps, 500);
    }

    function test_Register_RevertsOnResalePartnerShareWithoutPartner() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.resalePartnerBps = 250;
        _expectRedeemRevert(v, TRWIV4.BadParams.selector);
    }

    function test_LaterVoucher_CannotChangeResaleShares() public {
        bytes32 uid = _issue(1, partner, 1);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        v.resaleFeeBps = 1000;
        v.royaltyBps = 0;
        _redeem(buyer, v, 1);
        TRWIV4.Collection memory c = trwi.collection(1);
        assertEq(c.resaleFeeBps, 250);
        assertEq(c.royaltyBps, 250);
    }

    // ---- item 2: withdraw a false claim ----

    function test_Withdraw_OnlyWithdrawer() public {
        bytes32 uid = _issue(1, address(0), 1);
        bytes32 role = trwi.WITHDRAWER_ROLE();
        address[3] memory notAllowed = [admin, guardian, signer];
        for (uint256 i = 0; i < notAllowed.length; ++i) {
            vm.expectRevert(
                abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, notAllowed[i], role)
            );
            vm.prank(notAllowed[i]);
            trwi.withdraw(uid, "ipfs://reason");
        }
    }

    function test_Withdraw_EmitsAndMarks() public {
        bytes32 uid = _issue(1, address(0), 1);
        vm.expectEmit(address(trwi));
        emit TRWIV4.ImpactWithdrawn(uid, 1, withdrawer, "ipfs://reason");
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        assertTrue(trwi.withdrawnUID(uid));
        assertTrue(trwi.isWithdrawn(1));
        assertFalse(trwi.marketTerms(1).tradable);
        assertEq(trwi.balanceOf(buyer, 1), 1, "sold editions stay with the buyer");
    }

    function test_Withdraw_RequiresReasonAndLimitsLength() public {
        bytes32 uid = _attest(address(0));
        vm.startPrank(withdrawer);
        vm.expectRevert(TRWIV4.BadParams.selector);
        trwi.withdraw(uid, "");
        vm.expectRevert(TRWIV4.TextTooLong.selector);
        trwi.withdraw(uid, string(new bytes(257)));
        trwi.withdraw(uid, "ipfs://reason");
        vm.expectRevert(TRWIV4.AlreadyWithdrawn.selector);
        trwi.withdraw(uid, "ipfs://reason");
        vm.stopPrank();
    }

    function test_Withdrawn_BeforeFirstSale_CannotBeBought() public {
        bytes32 uid = _attest(address(0));
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), TRWIV4.ImpactIsWithdrawn.selector);
    }

    function test_Withdrawn_AfterSales_CannotBeBought() public {
        bytes32 uid = _issue(1, address(0), 1);
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), TRWIV4.ImpactIsWithdrawn.selector);
    }

    function test_Withdrawn_CannotBeRetired() public {
        bytes32 uid = _issue(1, address(0), 2);
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        vm.expectRevert(TRWIV4.ImpactIsWithdrawn.selector);
        vm.prank(buyer);
        trwi.retire(1, 1, "");
    }

    function test_Reinstate_OnlyAdmin_AndRestoresSale() public {
        bytes32 uid = _issue(1, address(0), 1);
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");

        bytes32 adminRole = trwi.DEFAULT_ADMIN_ROLE();
        address[2] memory notAllowed = [withdrawer, guardian];
        for (uint256 i = 0; i < notAllowed.length; ++i) {
            vm.expectRevert(
                abi.encodeWithSelector(
                    IAccessControl.AccessControlUnauthorizedAccount.selector, notAllowed[i], adminRole
                )
            );
            vm.prank(notAllowed[i]);
            trwi.reinstate(uid);
        }
        vm.prank(admin);
        trwi.reinstate(uid);
        assertFalse(trwi.isWithdrawn(1));
        _redeem(buyer, _voucher(1, uid, address(0), 0), 1);
        assertEq(trwi.balanceOf(buyer, 1), 2);

        vm.expectRevert(TRWIV4.NotWithdrawn.selector);
        vm.prank(admin);
        trwi.reinstate(uid);
    }

    // ---- revoked attestation: checked on every mint ----

    function test_Revoked_BeforeFirstSale_CannotBeBought() public {
        bytes32 uid = _attest(address(0));
        _revoke(uid);
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), TRWIV4.UID_Revoked.selector);
    }

    function test_Revoked_AfterFirstSale_CannotBeBought() public {
        bytes32 uid = _issue(1, address(0), 1);
        _revoke(uid);
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), TRWIV4.UID_Revoked.selector);
        assertFalse(trwi.marketTerms(1).tradable);
    }

    function test_Revoked_CannotBeRetired() public {
        bytes32 uid = _issue(1, address(0), 1);
        _revoke(uid);
        vm.expectRevert(TRWIV4.UID_Revoked.selector);
        vm.prank(buyer);
        trwi.retire(1, 1, "");
    }

    // ---- item 3: retire with contribution statement ----

    function test_Retire_WritesNumberedStatement() public {
        _issue(1, address(0), 10);
        vm.warp(1_800_000_000);
        vm.expectEmit(address(trwi));
        emit TRWIV4.ContributionStatement(1, 1, buyer, 3, (IV * 3) / EDITIONS, "Acme Ltd");
        vm.prank(buyer);
        uint256 id = trwi.retire(1, 3, "Acme Ltd");
        assertEq(id, 1);
        assertEq(trwi.statementCount(), 1);
        TRWIV4.Statement memory s = trwi.statement(1);
        assertEq(s.holder, buyer);
        assertEq(s.tokenId, 1);
        assertEq(s.amount, 3);
        assertEq(s.impactValue, 30 ether);
        assertEq(s.timestamp, 1_800_000_000);
        assertEq(s.inNameOf, "Acme Ltd");
        assertEq(trwi.retiredBy(1, buyer), 3);
        assertEq(trwi.balanceOf(buyer, 1), 7);
        assertEq(trwi.retiredEditions(1), 3);

        vm.prank(buyer);
        assertEq(trwi.retire(1, 2, ""), 2);
        assertEq(trwi.retiredBy(1, buyer), 5);
        assertEq(trwi.statement(2).inNameOf, "");
    }

    function test_Retire_RejectsLongInNameOf() public {
        _issue(1, address(0), 1);
        vm.expectRevert(TRWIV4.TextTooLong.selector);
        vm.prank(buyer);
        trwi.retire(1, 1, string(new bytes(65)));
        vm.prank(buyer);
        trwi.retire(1, 1, string(new bytes(64)));
    }

    function test_Retire_RejectsZeroUnknownAndOverBalance() public {
        _issue(1, address(0), 1);
        vm.startPrank(buyer);
        vm.expectRevert(TRWIV4.BadParams.selector);
        trwi.retire(1, 0, "");
        vm.expectRevert(TRWIV4.UnknownToken.selector);
        trwi.retire(2, 1, "");
        vm.expectRevert();
        trwi.retire(1, 2, "");
        vm.stopPrank();
        vm.expectRevert();
        vm.prank(stranger);
        trwi.retire(1, 1, "");
    }

    function test_Retire_WorksWhilePaused() public {
        _issue(1, address(0), 1);
        vm.prank(guardian);
        trwi.pause();
        vm.prank(buyer);
        trwi.retire(1, 1, "");
        assertEq(trwi.balanceOf(buyer, 1), 0);
    }

    // ---- item 6: non-transferable impact (built, switched off on the site) ----

    function test_NonTransferable_CannotMoveButCanRetire() public {
        bytes32 uid = _attestData(_claim(address(0), false));
        _redeem(buyer, _voucher(1, uid, address(0), 0), 2);
        assertFalse(trwi.collection(1).transferable);
        vm.expectRevert(TRWIV4.NonTransferable.selector);
        vm.prank(buyer);
        trwi.safeTransferFrom(buyer, stranger, 1, 1, "");
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amts = new uint256[](1);
        ids[0] = 1;
        amts[0] = 1;
        vm.expectRevert(TRWIV4.NonTransferable.selector);
        vm.prank(buyer);
        trwi.safeBatchTransferFrom(buyer, stranger, ids, amts, "");
        vm.prank(buyer);
        trwi.retire(1, 1, "");
        assertEq(trwi.balanceOf(buyer, 1), 1);
    }

    function test_Transferable_MovesFreely() public {
        _issue(1, address(0), 2);
        vm.prank(buyer);
        trwi.safeTransferFrom(buyer, stranger, 1, 1, "");
        assertEq(trwi.balanceOf(stranger, 1), 1);
    }

    // ---- item 15: guardian pauses, cannot unpause ----

    function test_Guardian_PausesButCannotUnpause() public {
        vm.prank(guardian);
        trwi.pause();
        assertTrue(trwi.paused());
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, guardian, trwi.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(guardian);
        trwi.unpause();
        vm.prank(admin);
        trwi.unpause();
        assertFalse(trwi.paused());
    }

    function test_Pause_OnlyGuardian() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, admin, trwi.GUARDIAN_ROLE()
            )
        );
        vm.prank(admin);
        trwi.pause();
    }

    function test_Paused_BlocksMint() public {
        bytes32 uid = _attest(address(0));
        vm.prank(guardian);
        trwi.pause();
        _expectRedeemRevert(_voucher(1, uid, address(0), 0), Pausable.EnforcedPause.selector);
    }

    // ---- item 11: upgradeable behind the upgrader (timelock in production) ----

    function test_Upgrade_OnlyUpgrader() public {
        TRWIV4 next = new TRWIV4();
        vm.expectRevert();
        vm.prank(stranger);
        trwi.upgradeToAndCall(address(next), "");
        vm.expectRevert();
        vm.prank(withdrawer);
        trwi.upgradeToAndCall(address(next), "");
        _issue(1, address(0), 1);
        vm.prank(admin);
        trwi.upgradeToAndCall(address(next), "");
        assertEq(trwi.balanceOf(buyer, 1), 1, "state survives the upgrade");
    }

    function test_Initialize_CannotRunTwice() public {
        vm.expectRevert();
        trwi.initialize(stranger, address(eas), schemaUID);
    }

    // ---- helpers ----

    function _expectRedeemRevert(RegenPrimarySaleV3.Voucher memory v, bytes4 sel) internal {
        _expectRedeemRevertAmount(v, 1, sel);
    }

    function _expectRedeemRevertAmount(RegenPrimarySaleV3.Voucher memory v, uint256 amount, bytes4 sel)
        internal
    {
        bytes memory sig = _sign(v);
        usd.mint(buyer, amount * v.pricePerEdition);
        vm.startPrank(buyer);
        usd.approve(address(sale), amount * v.pricePerEdition);
        vm.expectRevert(sel);
        sale.redeem(v, amount, sig);
        vm.stopPrank();
    }
}

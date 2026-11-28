// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { Revision4Base } from "./Revision4Base.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";

contract RegenPrimarySaleV3Test is Revision4Base {
    // ---- payment split to the last unit (unchanged rules) ----

    function test_Split_NoPartner_ExactUnits() public {
        bytes32 uid = _attest(address(0));
        _redeem(buyer, _voucher(1, uid, address(0), 0), 7); // 70 USD
        assertEq(usd.balanceOf(feeRecipient), 1_750_000); // 2.5%
        assertEq(usd.balanceOf(creatorPayout), 68_250_000); // 97.5%
        assertEq(usd.balanceOf(partner), 0);
        assertEq(usd.balanceOf(address(sale)), 0, "sale never holds money");
        assertEq(usd.balanceOf(buyer), 0);
        assertEq(trwi.balanceOf(buyer, 1), 7);
    }

    function test_Split_WithPartner_ExactUnits() public {
        bytes32 uid = _attest(partner);
        _redeem(buyer, _voucher(1, uid, partner, 250), 4); // 40 USD, partner 2.5%
        assertEq(usd.balanceOf(feeRecipient), 1_000_000);
        assertEq(usd.balanceOf(partner), 1_000_000);
        assertEq(usd.balanceOf(creatorPayout), 38_000_000); // 95%
        assertEq(usd.balanceOf(address(sale)), 0);
    }

    function test_Split_RoundingRemainderGoesToCreator() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 333);
        v.pricePerEdition = 1; // 1 unit: both shares round to 0
        _redeem(buyer, v, 3);
        assertEq(usd.balanceOf(feeRecipient), 0);
        assertEq(usd.balanceOf(partner), 0);
        assertEq(usd.balanceOf(creatorPayout), 3);
    }

    function test_Split_EmitsFullSaleRecord() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        bytes memory sig = _sign(v);
        usd.mint(buyer, 2 * PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), 2 * PRICE);
        vm.expectEmit(address(sale));
        emit RegenPrimarySaleV3.Sold(
            1,
            buyer,
            buyer,
            2,
            address(usd),
            RegenPrimarySaleV3.Payout({
                total: 20e6,
                creatorPaid: 18_500_000,
                platformPaid: 500_000,
                partnerPaid: 1_000_000,
                beneficiary: creatorPayout,
                partner: partner
            })
        );
        sale.redeem(v, 2, sig);
        vm.stopPrank();
    }

    function testFuzz_Split_SumsToPaymentAndNothingStays(uint96 price, uint8 amount, uint16 fee, uint16 pfee)
        public
    {
        price = uint96(bound(price, 1, 1e15));
        amount = uint8(bound(amount, 1, EDITIONS));
        fee = uint16(bound(fee, 0, 1000));
        pfee = uint16(bound(pfee, 0, 1000));
        vm.assume(uint256(fee) + pfee <= 1500);
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, pfee);
        v.pricePerEdition = price;
        v.feeBps = fee;
        _redeem(buyer, v, amount);
        uint256 total = uint256(price) * amount;
        assertEq(usd.balanceOf(feeRecipient), (total * fee) / 10_000);
        assertEq(usd.balanceOf(partner), (total * pfee) / 10_000);
        assertEq(
            usd.balanceOf(feeRecipient) + usd.balanceOf(partner) + usd.balanceOf(creatorPayout), total
        );
        assertEq(usd.balanceOf(address(sale)), 0);
        assertEq(usd.balanceOf(buyer), 0);
    }

    // ---- caps enforced (unchanged) ----

    function test_Caps_PlatformFeeAbove10Percent() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.feeBps = 1001;
        _expectRevert(v, RegenPrimarySaleV3.BadParams.selector);
    }

    function test_Caps_PartnerFeeAbove10Percent() public {
        bytes32 uid = _attest(partner);
        _expectRevert(_voucher(1, uid, partner, 1001), RegenPrimarySaleV3.BadParams.selector);
    }

    function test_Caps_CombinedAbove15Percent() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 1000);
        v.feeBps = 501;
        _expectRevert(v, RegenPrimarySaleV3.BadParams.selector);
        v.feeBps = 500; // exactly 15%
        _redeem(buyer, v, 1);
        assertEq(usd.balanceOf(creatorPayout), 8_500_000);
    }

    function test_Caps_MatchSite() public view {
        // apps/web/src/lib/partner-share.ts: PLATFORM_FEE_BPS 250, MAX_PARTNER_FEE_BPS 1000, MAX_TOTAL_FEE_BPS 1500
        assertEq(sale.MAX_FEE_BPS(), 1000);
        assertEq(sale.MAX_PARTNER_FEE_BPS(), 1000);
        assertEq(sale.MAX_TOTAL_FEE_BPS(), 1500);
    }

    function test_PartnerShareWithoutPartner_Reverts() public {
        bytes32 uid = _attest(address(0));
        _expectRevert(_voucher(1, uid, address(0), 100), RegenPrimarySaleV3.BadParams.selector);
    }

    // ---- item 13: deliver to another wallet ----

    function test_Recipient_ReceivesEditions_PayerPays() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.recipient = buyer2;
        _redeem(buyer, v, 2);
        assertEq(trwi.balanceOf(buyer2, 1), 2);
        assertEq(trwi.balanceOf(buyer, 1), 0);
        assertEq(usd.balanceOf(creatorPayout), 19_500_000);
    }

    function test_Recipient_IsSigned_CannotBeSwapped() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.recipient = buyer2;
        bytes memory sig = _sign(v);
        v.recipient = stranger;
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.BadSignature.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }

    // ---- item 10: stablecoins only ----

    function test_Currency_NotAllowlisted_Reverts() public {
        bytes32 uid = _attest(address(0));
        MockERC20 other = new MockERC20();
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.currency = address(other);
        _expectRevert(v, RegenPrimarySaleV3.BadCurrency.selector);
    }

    function test_Currency_NativeCoinRefused() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        v.currency = address(0);
        _expectRevert(v, RegenPrimarySaleV3.BadCurrency.selector);
        vm.expectRevert(RegenPrimarySaleV3.BadCurrency.selector);
        vm.prank(admin);
        sale.setCurrencyAllowed(address(0), true);
    }

    function test_Currency_SendingCoinWithRedeemFails() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes memory sig = _sign(v);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        (bool ok,) = address(sale).call{ value: 1 ether }(abi.encodeCall(sale.redeem, (v, 1, sig)));
        assertFalse(ok, "redeem is not payable");
    }

    function test_Currency_OnlyAdminAllowlists() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, signer, sale.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(signer);
        sale.setCurrencyAllowed(address(1), true);
    }

    // ---- voucher validity ----

    /// A voucher signed in the version 2 format (domain "2", v2 field list) must fail on version 3.
    function test_Version2Voucher_FailsOnVersion3() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes32 v2TypeHash = keccak256(
            "Voucher(uint256 tokenId,address creator,uint256 totalIV,uint256 maxEditions,uint256 pricePerEdition,address currency,address beneficiary,bytes32 easUID,string metadataURI,uint96 royaltyBps,uint96 feeBps,address partner,uint96 partnerFeeBps,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            bytes.concat(
                abi.encode(v2TypeHash, v.tokenId, v.creator, v.totalIV, v.maxEditions, v.pricePerEdition),
                abi.encode(v.currency, v.beneficiary, v.easUID, keccak256(bytes(v.metadataURI)), v.royaltyBps),
                abi.encode(v.feeBps, v.partner, v.partnerFeeBps, v.nonce, v.deadline)
            )
        );
        bytes32 domainV2 = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("RegenPrimarySale"),
                keccak256("2"),
                block.chainid,
                address(sale)
            )
        );
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(signerPk, MessageHashUtils.toTypedDataHash(domainV2, structHash));
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.BadSignature.selector);
        sale.redeem(v, 1, abi.encodePacked(r, s, vv));
        vm.stopPrank();
    }

    function test_Voucher_SignedByNonSigner_Reverts() public {
        bytes32 uid = _attest(address(0));
        (, uint256 pk) = makeAddrAndKey("notSigner");
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes memory sig = _signWith(v, pk);
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.BadSignature.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }

    function test_Voucher_TamperedPrice_Reverts() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes memory sig = _sign(v);
        v.pricePerEdition = 1;
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.BadSignature.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }

    function test_Voucher_Expired_Reverts() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes memory sig = _sign(v);
        vm.warp(v.deadline + 1);
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.Expired.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }

    function test_BumpNonce_InvalidatesVouchers_OnlySigner() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, admin, sale.SIGNER_ROLE()
            )
        );
        vm.prank(admin);
        sale.bumpNonce(1);
        vm.prank(signer);
        sale.bumpNonce(1);
        _expectRevert(v, RegenPrimarySaleV3.StaleVoucher.selector);
        v.nonce = 1;
        _redeem(buyer, v, 1);
    }

    function test_ZeroAmount_Reverts() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, address(0), 0);
        bytes memory sig = _sign(v);
        vm.expectRevert(RegenPrimarySaleV3.BadParams.selector);
        vm.prank(buyer);
        sale.redeem(v, 0, sig);
    }

    // ---- mintCap: edition limit (owner decision 28.11.2026) ----

    function _capped(bytes32 uid, uint256 cap) internal view returns (RegenPrimarySaleV3.Voucher memory v) {
        v = _voucher(1, uid, address(0), 0);
        v.mintCap = cap;
    }

    function test_MintCap_25_AllowsExactly25() public {
        bytes32 uid = _attest(address(0));
        _redeem(buyer, _capped(uid, 25), 25);
        assertEq(trwi.collection(1).minted, 25);
    }

    function test_MintCap_25_The26thEditionReverts() public {
        bytes32 uid = _attest(address(0));
        _redeem(buyer, _capped(uid, 25), 25);
        _expectRevert(_capped(uid, 25), RegenPrimarySaleV3.ExceedsMintCap.selector);
    }

    function test_MintCap_25_OneBuyOf26Reverts() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _capped(uid, 25);
        bytes memory sig = _sign(v);
        usd.mint(buyer, 26 * PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), 26 * PRICE);
        vm.expectRevert(RegenPrimarySaleV3.ExceedsMintCap.selector);
        sale.redeem(v, 26, sig);
        vm.stopPrank();
        assertEq(usd.balanceOf(buyer), 26 * PRICE, "nothing paid");
    }

    function test_MintCap_100_AllowsAll() public {
        bytes32 uid = _attest(address(0));
        _redeem(buyer, _capped(uid, 25), 25);
        _redeem(buyer2, _capped(uid, 100), 75);
        assertEq(trwi.collection(1).minted, 100);
    }

    function test_MintCap_BelowAlreadyMinted_Reverts() public {
        bytes32 uid = _attest(address(0));
        _redeem(buyer, _capped(uid, 100), 30);
        _expectRevert(_capped(uid, 25), RegenPrimarySaleV3.ExceedsMintCap.selector);
    }

    /// A cap-25 voucher signed at 0 sold cannot be used once others bought editions elsewhere.
    function test_MintCap_OldVoucherRespectsLaterSales() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory old = _capped(uid, 25);
        bytes memory oldSig = _sign(old);
        _redeem(buyer2, _capped(uid, 25), 20); // another buyer, another voucher
        usd.mint(buyer, 6 * PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), 6 * PRICE);
        vm.expectRevert(RegenPrimarySaleV3.ExceedsMintCap.selector);
        sale.redeem(old, 6, oldSig);
        sale.redeem(old, 5, oldSig); // exactly up to the cap is still fine
        vm.stopPrank();
        assertEq(trwi.collection(1).minted, 25);
    }

    /// Replaying the same voucher within its hour adds up against the cap.
    function test_MintCap_ReplayWithinTheHourRespectsCap() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _capped(uid, 25);
        bytes memory sig = _sign(v);
        usd.mint(buyer, 30 * PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), 30 * PRICE);
        sale.redeem(v, 10, sig);
        vm.warp(block.timestamp + 30 minutes);
        sale.redeem(v, 15, sig);
        vm.expectRevert(RegenPrimarySaleV3.ExceedsMintCap.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
        assertEq(trwi.collection(1).minted, 25);
    }

    function test_MintCap_IsSigned_CannotBeRaised() public {
        bytes32 uid = _attest(address(0));
        RegenPrimarySaleV3.Voucher memory v = _capped(uid, 25);
        bytes memory sig = _sign(v);
        v.mintCap = 100;
        usd.mint(buyer, PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), PRICE);
        vm.expectRevert(RegenPrimarySaleV3.BadSignature.selector);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }

    function testFuzz_MintCap_NeverExceeded(uint8 first, uint8 second, uint8 cap) public {
        cap = uint8(bound(cap, 1, EDITIONS));
        first = uint8(bound(first, 1, EDITIONS));
        second = uint8(bound(second, 1, EDITIONS));
        bytes32 uid = _attest(address(0));
        if (first <= cap) _redeem(buyer, _capped(uid, cap), first);
        uint256 minted = trwi.collection(1).minted;
        RegenPrimarySaleV3.Voucher memory v = _capped(uid, cap);
        bytes memory sig = _sign(v);
        usd.mint(buyer2, uint256(second) * PRICE);
        vm.startPrank(buyer2);
        usd.approve(address(sale), uint256(second) * PRICE);
        if (minted + second > cap) vm.expectRevert(RegenPrimarySaleV3.ExceedsMintCap.selector);
        sale.redeem(v, second, sig);
        vm.stopPrank();
        assertLe(trwi.collection(1).minted, cap);
    }

    // ---- item 15 + 7: roles ----

    function test_Guardian_PausesButCannotUnpause() public {
        bytes32 uid = _attest(address(0));
        vm.prank(guardian);
        sale.pause();
        _expectRevert(_voucher(1, uid, address(0), 0), Pausable.EnforcedPause.selector);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, guardian, sale.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(guardian);
        sale.unpause();
        vm.prank(admin);
        sale.unpause();
        _redeem(buyer, _voucher(1, uid, address(0), 0), 1);
    }

    function test_Roles_SignerCannotAdmin_AdminCannotSignOrPause() public {
        bytes32 signerRole = sale.SIGNER_ROLE();
        vm.startPrank(signer);
        vm.expectRevert();
        sale.setFeeRecipient(signer);
        vm.expectRevert();
        sale.pause();
        vm.expectRevert();
        sale.grantRole(signerRole, stranger);
        vm.stopPrank();
        vm.startPrank(admin);
        vm.expectRevert();
        sale.pause();
        vm.expectRevert();
        sale.bumpNonce(1);
        vm.stopPrank();
    }

    function test_SetFeeRecipient_AdminOnly_NonZero() public {
        vm.startPrank(admin);
        vm.expectRevert(RegenPrimarySaleV3.BadParams.selector);
        sale.setFeeRecipient(address(0));
        sale.setFeeRecipient(stranger);
        vm.stopPrank();
        assertEq(sale.feeRecipient(), stranger);
    }

    function test_Constructor_RejectsZero() public {
        vm.expectRevert(RegenPrimarySaleV3.BadParams.selector);
        new RegenPrimarySaleV3(address(0), address(trwi), feeRecipient);
        vm.expectRevert(RegenPrimarySaleV3.BadParams.selector);
        new RegenPrimarySaleV3(admin, address(trwi), address(0));
    }

    // ---- helpers ----

    function _expectRevert(RegenPrimarySaleV3.Voucher memory v, bytes4 sel) internal {
        bytes memory sig = _sign(v);
        usd.mint(buyer, v.pricePerEdition);
        vm.startPrank(buyer);
        usd.approve(address(sale), v.pricePerEdition);
        vm.expectRevert(sel);
        sale.redeem(v, 1, sig);
        vm.stopPrank();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Revision4Base } from "./Revision4Base.sol";
import { TRWIV4 } from "../../src/revision4/TRWIV4.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";
import { RegenMarketplaceV2 } from "../../src/revision4/RegenMarketplaceV2.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";

contract RegenMarketplaceV2Test is Revision4Base {
    uint256 internal constant RESALE_PRICE = 20e6;

    // ---- item 1: resale split 2.5 / 2.5 / 2.5, seller the rest ----

    function test_Resale_WithPartner_SellerGets92_5Percent() public {
        _issue(1, partner, 5);
        uint256 id = _list(buyer, 1, 5, RESALE_PRICE);
        uint256 total = 4 * RESALE_PRICE; // 80 USD
        uint256 creatorBefore = usd.balanceOf(creator);
        uint256 feeBefore = usd.balanceOf(feeRecipient);
        uint256 partnerBefore = usd.balanceOf(partner);
        _buyResale(buyer2, id, 4, total);
        assertEq(usd.balanceOf(creator) - creatorBefore, 2_000_000, "creator 2.5%");
        assertEq(usd.balanceOf(feeRecipient) - feeBefore, 2_000_000, "platform 2.5%");
        assertEq(usd.balanceOf(partner) - partnerBefore, 2_000_000, "partner 2.5%");
        assertEq(usd.balanceOf(buyer), 74_000_000, "seller 92.5%");
        assertEq(usd.balanceOf(address(market)), 0, "marketplace never holds money");
        assertEq(trwi.balanceOf(buyer2, 1), 4);
        assertEq(trwi.balanceOf(address(market), 1), 1);
        (,, uint256 remaining,,, bool active) = market.listings(id);
        assertEq(remaining, 1);
        assertTrue(active);
    }

    function test_Resale_NoPartner_SellerGets95Percent_NoPartnerPayment() public {
        _issue(1, address(0), 5);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        _buyResale(buyer2, id, 2, 2 * RESALE_PRICE); // 40 USD
        assertEq(usd.balanceOf(creator), 1_000_000);
        assertEq(usd.balanceOf(buyer), 38_000_000, "seller 95%");
        assertEq(usd.balanceOf(partner), 0, "no partner, no partner payment");
        assertEq(usd.balanceOf(address(market)), 0);
        (,,,,, bool active) = market.listings(id);
        assertFalse(active);
    }

    function test_Resale_EmitsFullRecord() public {
        _issue(1, partner, 1);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        usd.mint(buyer2, RESALE_PRICE);
        vm.startPrank(buyer2);
        usd.approve(address(market), RESALE_PRICE);
        vm.expectEmit(address(market));
        emit RegenMarketplaceV2.Purchased(
            id, buyer2, 1, 1, address(usd), RESALE_PRICE, 18_500_000, 500_000, 500_000, 500_000
        );
        market.buy(id, 1);
        vm.stopPrank();
    }

    function test_Resale_CombinedSharesCapped_SellerAtLeast85Percent() public {
        bytes32 uid = _attest(partner);
        RegenPrimarySaleV3.Voucher memory v = _voucher(1, uid, partner, 500);
        v.royaltyBps = 500;
        v.resaleFeeBps = 500;
        v.resalePartnerBps = 500; // the maximum combined, 15%
        _redeem(buyer, v, 1);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        _buyResale(buyer2, id, 1, RESALE_PRICE);
        assertEq(usd.balanceOf(buyer), 17_000_000, "seller 85% at the cap");
    }

    function testFuzz_Resale_SumsToPriceAndNothingStays(uint96 price, uint8 amount, bool withPartner) public {
        price = uint96(bound(price, 1, 1e15));
        amount = uint8(bound(amount, 1, 50));
        address p = withPartner ? partner : address(0);
        _issue(1, p, 50);
        uint256 id = _list(buyer, 1, 50, price);
        uint256 total = uint256(price) * amount;
        uint256 creatorBefore = usd.balanceOf(creator);
        uint256 feeBefore = usd.balanceOf(feeRecipient);
        uint256 partnerBefore = usd.balanceOf(partner);
        _buyResale(buyer2, id, amount, total);
        uint256 paid = (usd.balanceOf(creator) - creatorBefore) + (usd.balanceOf(feeRecipient) - feeBefore)
            + (usd.balanceOf(partner) - partnerBefore) + usd.balanceOf(buyer);
        assertEq(paid, total);
        assertEq(usd.balanceOf(buyer2), 0);
        assertEq(usd.balanceOf(address(market)), 0);
        if (!withPartner) assertEq(usd.balanceOf(partner), partnerBefore);
        assertEq(usd.balanceOf(creator) - creatorBefore, (total * 250) / 10_000);
    }

    function test_Quote_MatchesPayout() public {
        _issue(1, partner, 2);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        RegenMarketplaceV2.Split memory q = market.quote(id, 2);
        assertEq(q.total, 40e6);
        assertEq(q.sellerPaid, 37_000_000);
        assertEq(q.creatorPaid + q.platformPaid + q.partnerPaid + q.sellerPaid, q.total);
    }

    function test_Resale_SixDecimalCoin_ExactUnits() public {
        MockStable6R usdc = new MockStable6R();
        vm.prank(admin);
        market.setCurrencyAllowed(address(usdc), true);
        _issue(1, partner, 3);
        vm.startPrank(buyer);
        trwi.setApprovalForAll(address(market), true);
        uint256 id = market.list(1, 3, 3_333_333, address(usdc)); // 3.333333 USD
        vm.stopPrank();
        usdc.mint(buyer2, 9_999_999);
        vm.startPrank(buyer2);
        usdc.approve(address(market), 9_999_999);
        market.buy(id, 3);
        vm.stopPrank();
        assertEq(usdc.balanceOf(creator), 249_999); // 2.5% rounded down
        assertEq(usdc.balanceOf(feeRecipient), 249_999);
        assertEq(usdc.balanceOf(partner), 249_999);
        assertEq(usdc.balanceOf(buyer), 9_250_002, "seller gets the rest, incl. rounding");
        assertEq(usdc.balanceOf(address(market)), 0);
    }

    function test_Resale_EighteenDecimalCoin_ExactUnits() public {
        _issue(1, partner, 3);
        uint256 id = _list(buyer, 1, 3, 3_333_333 * 1e12);
        uint256 total = 9_999_999 * 1e12;
        uint256 before = usd.balanceOf(creator);
        _buyResale(buyer2, id, 3, total);
        assertEq(usd.balanceOf(creator) - before, 249_999_975 * 1e9);
        assertEq(usd.balanceOf(buyer), total - 3 * (249_999_975 * 1e9), "seller 92.5% exact");
        assertEq(usd.balanceOf(address(market)), 0);
    }

    function test_Buy_RefusedAfterCurrencyRemoved_SellerCanCancel() public {
        _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        vm.prank(admin);
        market.setCurrencyAllowed(address(usd), false);
        usd.mint(buyer2, RESALE_PRICE);
        vm.startPrank(buyer2);
        usd.approve(address(market), RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.BadCurrency.selector);
        market.buy(id, 1);
        vm.stopPrank();
        vm.prank(buyer);
        market.cancel(id);
        assertEq(trwi.balanceOf(buyer, 1), 2);
    }

    function test_CancelTo_SellerOnly_NonZero() public {
        _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.NotSeller.selector);
        vm.prank(admin);
        market.cancelTo(id, admin);
        vm.expectRevert(RegenMarketplaceV2.BadParams.selector);
        vm.prank(buyer);
        market.cancelTo(id, address(0));
        vm.prank(buyer);
        market.cancelTo(id, buyer2);
        assertEq(trwi.balanceOf(buyer2, 1), 2, "editions go to the seller's chosen wallet");
        vm.expectRevert(RegenMarketplaceV2.NotAvailable.selector);
        vm.prank(buyer);
        market.cancelTo(id, buyer2);
    }

    // ---- withdrawn / revoked / non-transferable are refused ----

    function test_Withdrawn_CannotBeListed() public {
        bytes32 uid = _issue(1, address(0), 2);
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        vm.startPrank(buyer);
        trwi.setApprovalForAll(address(market), true);
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        market.list(1, 1, RESALE_PRICE, address(usd));
        vm.stopPrank();
    }

    function test_Withdrawn_CannotBeBoughtOnResale_SellerCanCancel() public {
        bytes32 uid = _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        vm.prank(withdrawer);
        trwi.withdraw(uid, "ipfs://reason");
        usd.mint(buyer2, RESALE_PRICE);
        vm.startPrank(buyer2);
        usd.approve(address(market), RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        market.buy(id, 1);
        vm.stopPrank();
        vm.prank(buyer);
        market.cancel(id);
        assertEq(trwi.balanceOf(buyer, 1), 2, "seller gets the editions back");
    }

    function test_Revoked_CannotBeListedOrBought() public {
        bytes32 uid = _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        _revoke(uid);
        vm.startPrank(buyer);
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        market.list(1, 1, RESALE_PRICE, address(usd));
        vm.stopPrank();
        usd.mint(buyer2, RESALE_PRICE);
        vm.startPrank(buyer2);
        usd.approve(address(market), RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        market.buy(id, 1);
        vm.stopPrank();
    }

    function test_NonTransferable_CannotBeListed() public {
        bytes32 uid = _attestData(_claim(address(0), false));
        _redeem(buyer, _voucher(1, uid, address(0), 0), 1);
        vm.startPrank(buyer);
        trwi.setApprovalForAll(address(market), true);
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        market.list(1, 1, RESALE_PRICE, address(usd));
        vm.stopPrank();
    }

    function test_UnknownToken_CannotBeListed() public {
        vm.expectRevert(RegenMarketplaceV2.NotTradable.selector);
        vm.prank(buyer);
        market.list(9, 1, RESALE_PRICE, address(usd));
    }

    // ---- stablecoins only ----

    function test_Currency_NotAllowlisted_Reverts() public {
        _issue(1, address(0), 1);
        MockERC20 other = new MockERC20();
        vm.startPrank(buyer);
        trwi.setApprovalForAll(address(market), true);
        vm.expectRevert(RegenMarketplaceV2.BadCurrency.selector);
        market.list(1, 1, RESALE_PRICE, address(other));
        vm.expectRevert(RegenMarketplaceV2.BadCurrency.selector);
        market.list(1, 1, RESALE_PRICE, address(0));
        vm.stopPrank();
        vm.expectRevert(RegenMarketplaceV2.BadCurrency.selector);
        vm.prank(admin);
        market.setCurrencyAllowed(address(0), true);
    }

    function test_Buy_SendingCoinFails() public {
        _issue(1, address(0), 1);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        vm.deal(buyer2, 1 ether);
        vm.prank(buyer2);
        (bool ok,) = address(market).call{ value: 1 ether }(abi.encodeCall(market.buy, (id, 1)));
        assertFalse(ok, "buy is not payable");
    }

    // ---- pause: guardian pauses, cannot unpause; cancel always works ----

    function test_Paused_BlocksListAndBuy_CancelWorks() public {
        _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        vm.prank(guardian);
        market.pause();
        vm.startPrank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.list(1, 1, RESALE_PRICE, address(usd));
        vm.stopPrank();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(buyer2);
        market.buy(id, 1);
        vm.prank(buyer);
        market.cancel(id);
        assertEq(trwi.balanceOf(buyer, 1), 2);
    }

    function test_Guardian_CannotUnpause() public {
        vm.prank(guardian);
        market.pause();
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, guardian, market.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(guardian);
        market.unpause();
        vm.prank(admin);
        market.unpause();
        assertFalse(market.paused());
    }

    // ---- escrow safety ----

    function test_Cancel_OnlySellerOrAdmin() public {
        _issue(1, address(0), 1);
        uint256 id = _list(buyer, 1, 1, RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.NotSeller.selector);
        vm.prank(stranger);
        market.cancel(id);
        vm.expectRevert(RegenMarketplaceV2.NotSeller.selector);
        vm.prank(guardian);
        market.cancel(id);
        vm.prank(admin);
        market.cancel(id);
        assertEq(trwi.balanceOf(buyer, 1), 1, "admin cancel returns to the seller");
        vm.expectRevert(RegenMarketplaceV2.NotAvailable.selector);
        vm.prank(buyer);
        market.cancel(id);
    }

    function test_Buy_MoreThanRemaining_Reverts() public {
        _issue(1, address(0), 2);
        uint256 id = _list(buyer, 1, 2, RESALE_PRICE);
        vm.expectRevert(RegenMarketplaceV2.NotAvailable.selector);
        vm.prank(buyer2);
        market.buy(id, 3);
    }

    function test_DirectTransferToMarketplace_Rejected() public {
        _issue(1, address(0), 1);
        vm.expectRevert(RegenMarketplaceV2.UnexpectedTransfer.selector);
        vm.prank(buyer);
        trwi.safeTransferFrom(buyer, address(market), 1, 1, "");
    }

    function test_List_ZeroAmountOrPrice_Reverts() public {
        _issue(1, address(0), 1);
        vm.startPrank(buyer);
        vm.expectRevert(RegenMarketplaceV2.BadParams.selector);
        market.list(1, 0, RESALE_PRICE, address(usd));
        vm.expectRevert(RegenMarketplaceV2.BadParams.selector);
        market.list(1, 1, 0, address(usd));
        vm.stopPrank();
    }

    function test_AdminSettings_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(guardian);
        market.setFeeRecipient(guardian);
        vm.expectRevert();
        vm.prank(stranger);
        market.setCurrencyAllowed(address(1), true);
        vm.prank(admin);
        market.setFeeRecipient(stranger);
        assertEq(market.feeRecipient(), stranger);
    }
}

contract MockStable6R is MockERC20 {
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

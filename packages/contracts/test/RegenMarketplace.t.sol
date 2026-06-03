// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {RegenMarketplace} from "../src/RegenMarketplace.sol";
import {MockImpactToken} from "./mocks/MockImpactToken.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract RegenMarketplaceTest is Test {
    RegenMarketplace internal mkt;
    MockImpactToken internal token;
    MockERC20 internal usd;

    address internal admin = address(this);
    address internal seller = makeAddr("seller"); // platform/operator custody
    address internal ngo = makeAddr("ngo"); // beneficiary
    address internal creator = makeAddr("creator"); // royalty receiver
    address internal feeRecipient = makeAddr("fee");
    address internal buyer = makeAddr("buyer");

    uint256 internal constant ID = 1;
    uint256 internal constant PRICE = 0.01 ether;

    function setUp() public {
        token = new MockImpactToken();
        usd = new MockERC20();
        mkt = new RegenMarketplace(admin, address(token), feeRecipient, 250); // 2.5% fee

        token.mint(seller, ID, 100);
        token.setRoyalty(ID, creator, 500); // 5% royalty -> creator
        vm.prank(seller);
        token.setApprovalForAll(address(mkt), true);
    }

    function _list() internal returns (uint256 id) {
        vm.prank(seller);
        id = mkt.list(ID, 100, PRICE, address(0), ngo); // address(0) = NATIVE
    }

    function test_ListEscrowsEditions() public {
        uint256 id = _list();
        assertEq(token.balanceOf(address(mkt), ID), 100);
        assertEq(token.balanceOf(seller, ID), 0);
        (, address beneficiary,, uint256 remaining,,, bool active) = mkt.listings(id);
        assertEq(beneficiary, ngo);
        assertEq(remaining, 100);
        assertTrue(active);
    }

    function test_BuyNative_SplitsFeeRoyaltyBeneficiary() public {
        uint256 id = _list();
        uint256 total = 10 * PRICE; // 0.1 ether
        vm.deal(buyer, total);

        vm.prank(buyer);
        mkt.buy{value: total}(id, 10);

        // editions delivered, escrow reduced
        assertEq(token.balanceOf(buyer, ID), 10);
        assertEq(token.balanceOf(address(mkt), ID), 90);

        // payouts: fee 2.5%, royalty 5% -> creator, remainder -> ngo
        uint256 fee = (total * 250) / 10_000;
        uint256 royalty = (total * 500) / 10_000;
        assertEq(feeRecipient.balance, fee);
        assertEq(creator.balance, royalty);
        assertEq(ngo.balance, total - fee - royalty);
    }

    function test_BuyERC20() public {
        vm.prank(seller);
        uint256 id = mkt.list(ID, 100, PRICE, address(usd), ngo);

        uint256 total = 5 * PRICE;
        usd.mint(buyer, total);
        vm.startPrank(buyer);
        usd.approve(address(mkt), total);
        mkt.buy(id, 5);
        vm.stopPrank();

        assertEq(token.balanceOf(buyer, ID), 5);
        uint256 fee = (total * 250) / 10_000;
        uint256 royalty = (total * 500) / 10_000;
        assertEq(usd.balanceOf(feeRecipient), fee);
        assertEq(usd.balanceOf(creator), royalty);
        assertEq(usd.balanceOf(ngo), total - fee - royalty);
    }

    function test_Cancel_ReturnsToSeller() public {
        uint256 id = _list();
        vm.prank(seller);
        mkt.cancel(id);
        assertEq(token.balanceOf(seller, ID), 100);
        assertEq(token.balanceOf(address(mkt), ID), 0);
    }

    function test_Revert_BuyTooMany() public {
        uint256 id = _list();
        vm.deal(buyer, 1000 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenMarketplace.NotAvailable.selector);
        mkt.buy{value: 101 * PRICE}(id, 101);
    }

    function test_Revert_WrongNativeValue() public {
        uint256 id = _list();
        vm.deal(buyer, 1000 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenMarketplace.WrongPayment.selector);
        mkt.buy{value: 1 ether}(id, 10); // should be 10*PRICE = 0.1 ether
    }

    function test_Revert_NonSellerCancel() public {
        uint256 id = _list();
        vm.prank(buyer);
        vm.expectRevert(RegenMarketplace.NotSeller.selector);
        mkt.cancel(id);
    }

    function test_FullSale_ClosesListing() public {
        uint256 id = _list();
        vm.deal(buyer, 100 * PRICE);
        vm.prank(buyer);
        mkt.buy{value: 100 * PRICE}(id, 100);
        (,,, uint256 remaining,,, bool active) = mkt.listings(id);
        assertEq(remaining, 0);
        assertFalse(active);
    }
}

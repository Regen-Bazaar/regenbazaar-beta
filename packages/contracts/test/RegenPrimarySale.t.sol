// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";
import { TRWI } from "../src/TRWI.sol";
import { MockEAS } from "./mocks/MockEAS.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@ethereum-attestation-service/eas-contracts/Common.sol";

contract RegenPrimarySaleTest is Test {
    RegenPrimarySale internal sale;
    TRWI internal trwi;
    MockEAS internal eas;
    MockERC20 internal usd;

    address internal admin = address(this);
    address internal ngo = makeAddr("ngo");
    address internal feeRecipient = makeAddr("fee");
    address internal buyer = makeAddr("buyer");
    address internal signer;
    uint256 internal signerPk;

    bytes32 internal constant SCHEMA = keccak256("ImpactClaim");
    bytes32 internal constant UID1 = bytes32(uint256(0x1));
    uint256 internal constant PRICE = 0.01 ether;

    function setUp() public {
        (signer, signerPk) = makeAddrAndKey("signer");
        eas = new MockEAS();
        usd = new MockERC20();
        TRWI impl = new TRWI();
        trwi = TRWI(
            address(
                new ERC1967Proxy(
                    address(impl), abi.encodeCall(TRWI.initialize, (admin, address(eas), SCHEMA))
                )
            )
        );
        sale = new RegenPrimarySale(admin, address(trwi), feeRecipient);
        trwi.grantRole(trwi.MINTER_ROLE(), address(sale));
        sale.grantRole(sale.SIGNER_ROLE(), signer);
        sale.setCurrencyAllowed(address(usd), true); // allowlist the ERC-20 payment currency
        eas.set(_att(ngo, 1000 ether, "ipfs://meta1"));
    }

    function _att(address ngo_, uint256 iv, string memory m) internal pure returns (Attestation memory) {
        return Attestation({
            uid: UID1,
            schema: SCHEMA,
            time: 0,
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: ngo_,
            attester: address(0xBEEF),
            revocable: true,
            data: abi.encode(ngo_, iv, m)
        });
    }

    function _voucher(address currency, uint256 nonce)
        internal
        view
        returns (RegenPrimarySale.Voucher memory)
    {
        return RegenPrimarySale.Voucher({
            tokenId: 1,
            creator: ngo,
            totalIV: 1000 ether,
            maxEditions: 100,
            pricePerEdition: PRICE,
            currency: currency,
            beneficiary: ngo,
            easUID: UID1,
            metadataURI: "ipfs://meta1",
            royaltyBps: 500,
            feeBps: 250, // 2.5% platform fee, now part of the signed voucher
            nonce: nonce,
            deadline: block.timestamp + 1 days
        });
    }

    function _sign(RegenPrimarySale.Voucher memory v, uint256 pk) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(pk, sale.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    function test_RedeemNative_MintsAndSplits() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);

        uint256 total = 10 * PRICE;
        vm.deal(buyer, total);
        vm.prank(buyer);
        sale.redeem{ value: total }(v, 10, sig);

        assertEq(trwi.balanceOf(buyer, 1), 10);
        assertEq(trwi.collection(1).minted, 10);
        uint256 fee = (total * 250) / 10_000;
        assertEq(feeRecipient.balance, fee);
        assertEq(ngo.balance, total - fee);
    }

    function test_RedeemERC20() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(usd), 0);
        bytes memory sig = _sign(v, signerPk);
        uint256 total = 5 * PRICE;
        usd.mint(buyer, total);
        vm.startPrank(buyer);
        usd.approve(address(sale), total);
        sale.redeem(v, 5, sig);
        vm.stopPrank();

        assertEq(trwi.balanceOf(buyer, 1), 5);
        uint256 fee = (total * 250) / 10_000;
        assertEq(usd.balanceOf(feeRecipient), fee);
        assertEq(usd.balanceOf(ngo), total - fee);
    }

    function test_Revert_BadSignature() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        (, uint256 wrongPk) = makeAddrAndKey("wrong");
        bytes memory sig = _sign(v, wrongPk); // not a SIGNER
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadSignature.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_Revert_Expired() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        v.deadline = block.timestamp - 1;
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.Expired.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_Revert_StaleNonce_AfterBump() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0); // nonce 0
        bytes memory sig = _sign(v, signerPk);
        vm.prank(signer);
        sale.bumpNonce(1); // currentNonce[1] -> 1, so the nonce-0 voucher is now stale
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.StaleVoucher.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_BumpNonce_RepriceWorks() public {
        vm.prank(signer);
        sale.bumpNonce(1); // now currentNonce[1] = 1
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 1); // new nonce
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
        assertEq(trwi.balanceOf(buyer, 1), 10);
    }

    function test_Revert_WrongValue() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.WrongPayment.selector);
        sale.redeem{ value: 1 ether }(v, 10, sig); // should be 10*PRICE
    }

    function test_Revert_ExceedsMaxAcrossRedeems() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 200 * PRICE);
        vm.startPrank(buyer);
        sale.redeem{ value: 100 * PRICE }(v, 100, sig);
        vm.expectRevert(TRWI.ExceedsMax.selector);
        sale.redeem{ value: 1 * PRICE }(v, 1, sig);
        vm.stopPrank();
    }

    /// M2: the platform fee is part of the signed voucher — changing it invalidates the signature.
    function test_TamperedFeeBps_RevertsBadSignature() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);
        v.feeBps = 1000; // tamper after signing
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadSignature.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    /// L1: only NATIVE + allowlisted ERC-20s are accepted.
    function test_NonAllowlistedCurrency_Reverts() public {
        MockERC20 other = new MockERC20();
        RegenPrimarySale.Voucher memory v = _voucher(address(other), 0);
        bytes memory sig = _sign(v, signerPk);
        other.mint(buyer, 10 * PRICE);
        vm.startPrank(buyer);
        other.approve(address(sale), 10 * PRICE);
        vm.expectRevert(RegenPrimarySale.BadCurrency.selector);
        sale.redeem(v, 10, sig);
        vm.stopPrank();
    }

    /// M4: a pause blocks redemption.
    function test_Paused_BlocksRedeem() public {
        sale.grantRole(sale.PAUSER_ROLE(), address(this));
        sale.pause();
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(); // EnforcedPause
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    /// L1: an allowlisted currency can be de-listed, after which it is rejected.
    function test_SetCurrencyAllowed_Toggle_Off_Reverts() public {
        sale.setCurrencyAllowed(address(usd), false);
        RegenPrimarySale.Voucher memory v = _voucher(address(usd), 0);
        bytes memory sig = _sign(v, signerPk);
        usd.mint(buyer, 10 * PRICE);
        vm.startPrank(buyer);
        usd.approve(address(sale), 10 * PRICE);
        vm.expectRevert(RegenPrimarySale.BadCurrency.selector);
        sale.redeem(v, 10, sig);
        vm.stopPrank();
    }
}

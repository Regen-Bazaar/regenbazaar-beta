// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, Vm } from "forge-std/Test.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";
import { TRWI } from "../src/TRWI.sol";
import { MockEAS } from "./mocks/MockEAS.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
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
    address internal partner = makeAddr("partner");
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
            partner: address(0),
            partnerFeeBps: 0,
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

    // ---------------------------------------------------------------- partner share (v2)

    function _partnerVoucher(address currency, uint96 feeBps, uint96 partnerFeeBps)
        internal
        view
        returns (RegenPrimarySale.Voucher memory v)
    {
        v = _voucher(currency, 0);
        v.feeBps = feeBps;
        v.partner = partner;
        v.partnerFeeBps = partnerFeeBps;
    }

    function test_Partner_Native_ThreeWaySplit() public {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 500, 500);
        bytes memory sig = _sign(v, signerPk);
        uint256 total = 10 * PRICE;
        vm.deal(buyer, total);
        vm.expectEmit(true, true, false, true, address(sale));
        emit RegenPrimarySale.PartnerPaid(1, partner, (total * 500) / 10_000, address(0));
        vm.prank(buyer);
        sale.redeem{ value: total }(v, 10, sig);

        uint256 fee = (total * 500) / 10_000;
        uint256 pFee = (total * 500) / 10_000;
        assertEq(feeRecipient.balance, fee);
        assertEq(partner.balance, pFee);
        assertEq(ngo.balance, total - fee - pFee);
        assertEq(address(sale).balance, 0);
        assertEq(trwi.balanceOf(buyer, 1), 10);
    }

    function test_Partner_ERC20_ThreeWaySplit() public {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(usd), 250, 500);
        bytes memory sig = _sign(v, signerPk);
        uint256 total = 7 * PRICE;
        usd.mint(buyer, total);
        vm.startPrank(buyer);
        usd.approve(address(sale), total);
        sale.redeem(v, 7, sig);
        vm.stopPrank();

        uint256 fee = (total * 250) / 10_000;
        uint256 pFee = (total * 500) / 10_000;
        assertEq(usd.balanceOf(feeRecipient), fee);
        assertEq(usd.balanceOf(partner), pFee);
        assertEq(usd.balanceOf(ngo), total - fee - pFee);
        assertEq(usd.balanceOf(address(sale)), 0);
    }

    function test_NoPartner_PaysNothingExtra() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes memory sig = _sign(v, signerPk);
        uint256 total = 10 * PRICE;
        vm.deal(buyer, total);
        vm.recordLogs();
        vm.prank(buyer);
        sale.redeem{ value: total }(v, 10, sig);
        bytes32 partnerPaid = keccak256("PartnerPaid(uint256,address,uint256,address)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != partnerPaid);
        }
        assertEq(partner.balance, 0);
    }

    function test_Partner_AtLimits_Succeeds() public {
        // platform 5% + partner 10% = 15% total, the maximum
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 500, 1000);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
        assertEq(partner.balance, (10 * PRICE * 1000) / 10_000);
    }

    function test_Revert_PartnerFeeAboveMax() public {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 0, 1001);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadParams.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_Revert_TotalFeeAboveMax() public {
        // 10% + 6% = 16% > 15%, each within its own cap
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 1000, 600);
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadParams.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_Revert_PartnerFeeWithoutPartner() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        v.partnerFeeBps = 100;
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadParams.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_TamperedPartner_RevertsBadSignature() public {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 250, 500);
        bytes memory sig = _sign(v, signerPk);
        v.partner = makeAddr("attacker");
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadSignature.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function test_TamperedPartnerFee_RevertsBadSignature() public {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(0), 250, 100);
        bytes memory sig = _sign(v, signerPk);
        v.partnerFeeBps = 500;
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadSignature.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    /// A signature made for the v1 domain ("RegenPrimarySale", "1") must not redeem on v2.
    function test_Revert_V1DomainSignature() public {
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        bytes32 v1Domain = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("RegenPrimarySale"),
                keccak256("1"),
                block.chainid,
                address(sale)
            )
        );
        bytes32 structHash = _structHashV2(v);
        (uint8 vv, bytes32 r, bytes32 s) =
            vm.sign(signerPk, MessageHashUtils.toTypedDataHash(v1Domain, structHash));
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.BadSignature.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, abi.encodePacked(r, s, vv));
    }

    function test_HashVoucher_MatchesTypedData() public view {
        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(usd), 250, 500);
        (, string memory name, string memory version, uint256 chainId, address verifying,,) =
            sale.eip712Domain();
        assertEq(name, "RegenPrimarySale");
        assertEq(version, "2");
        bytes32 domain = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                verifying
            )
        );
        assertEq(sale.hashVoucher(v), MessageHashUtils.toTypedDataHash(domain, _structHashV2(v)));
    }

    function _structHashV2(RegenPrimarySale.Voucher memory v) internal pure returns (bytes32) {
        bytes32 typehash = keccak256(
            "Voucher(uint256 tokenId,address creator,uint256 totalIV,uint256 maxEditions,uint256 pricePerEdition,address currency,address beneficiary,bytes32 easUID,string metadataURI,uint96 royaltyBps,uint96 feeBps,address partner,uint96 partnerFeeBps,uint256 nonce,uint256 deadline)"
        );
        return keccak256(
            bytes.concat(
                abi.encode(
                    typehash, v.tokenId, v.creator, v.totalIV, v.maxEditions, v.pricePerEdition, v.currency
                ),
                abi.encode(v.beneficiary, v.easUID, keccak256(bytes(v.metadataURI)), v.royaltyBps, v.feeBps),
                abi.encode(v.partner, v.partnerFeeBps, v.nonce, v.deadline)
            )
        );
    }

    /// A partner that rejects native payment makes the whole redeem revert (no partial payouts).
    function test_Revert_PartnerRejectsPayment() public {
        RejectingReceiver bad = new RejectingReceiver();
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        v.partner = address(bad);
        v.partnerFeeBps = 500;
        bytes memory sig = _sign(v, signerPk);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.TransferFailed.selector);
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
        assertEq(feeRecipient.balance, 0);
        assertEq(ngo.balance, 0);
        assertEq(trwi.balanceOf(buyer, 1), 0);
    }

    /// A partner that re-enters redeem cannot mint twice or skim funds.
    function test_Revert_PartnerReentrancy() public {
        ReentrantPartner evil = new ReentrantPartner(sale);
        RegenPrimarySale.Voucher memory v = _voucher(address(0), 0);
        v.partner = address(evil);
        v.partnerFeeBps = 500;
        bytes memory sig = _sign(v, signerPk);
        evil.arm(v, sig);
        vm.deal(address(evil), 10 * PRICE);
        vm.deal(buyer, 10 * PRICE);
        vm.prank(buyer);
        vm.expectRevert(RegenPrimarySale.TransferFailed.selector); // inner redeem hits ReentrancyGuard
        sale.redeem{ value: 10 * PRICE }(v, 10, sig);
    }

    function testFuzz_Partner_SplitSumsToTotal(
        uint96 feeBps,
        uint96 partnerFeeBps,
        uint8 amount,
        uint64 price
    ) public {
        feeBps = uint96(bound(feeBps, 0, 1000));
        partnerFeeBps = uint96(bound(partnerFeeBps, 1, 1000));
        vm.assume(uint256(feeBps) + partnerFeeBps <= 1500);
        amount = uint8(bound(amount, 1, 100));
        price = uint64(bound(price, 1, 1e18));

        RegenPrimarySale.Voucher memory v = _partnerVoucher(address(usd), feeBps, partnerFeeBps);
        v.pricePerEdition = price;
        bytes memory sig = _sign(v, signerPk);
        uint256 total = uint256(amount) * price;
        usd.mint(buyer, total);
        vm.startPrank(buyer);
        usd.approve(address(sale), total);
        sale.redeem(v, amount, sig);
        vm.stopPrank();

        assertEq(usd.balanceOf(feeRecipient) + usd.balanceOf(partner) + usd.balanceOf(ngo), total);
        assertEq(usd.balanceOf(address(sale)), 0);
        assertGe(usd.balanceOf(ngo), total - (total * 1500) / 10_000);
    }
}

contract RejectingReceiver {
    receive() external payable {
        revert("no");
    }
}

contract ReentrantPartner {
    RegenPrimarySale internal immutable sale;
    RegenPrimarySale.Voucher internal v;
    bytes internal sig;
    bool internal armed;

    constructor(RegenPrimarySale sale_) {
        sale = sale_;
    }

    function arm(RegenPrimarySale.Voucher memory v_, bytes memory sig_) external {
        v = v_;
        sig = sig_;
        armed = true;
    }

    receive() external payable {
        if (!armed) return;
        armed = false;
        sale.redeem{ value: 10 * v.pricePerEdition }(v, 10, sig);
    }
}

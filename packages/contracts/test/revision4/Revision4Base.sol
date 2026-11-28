// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import { EAS } from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import {
    IEAS,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";

import { AuthorizedAttesterResolver } from "../../src/AuthorizedAttesterResolver.sol";
import { TRWIV4 } from "../../src/revision4/TRWIV4.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";
import { RegenMarketplaceV2 } from "../../src/revision4/RegenMarketplaceV2.sol";
import { MockERC20 } from "../mocks/MockERC20.sol";

/// @dev Revision 4 under test against a REAL EAS + SchemaRegistry (revocation and the attester gate are real).
///      Roles are separate addresses as in production; `admin` stands in for the timelock here (the timelock
///      itself is exercised in DeployRevision4.t.sol).
abstract contract Revision4Base is Test {
    string internal constant SCHEMA_V2 =
        "address creator,uint256 impactValue,string metadataURI,uint8 proofLevel,string methodologyVersion,address validator,address partner,bool transferable";

    SchemaRegistry internal registry;
    EAS internal eas;
    AuthorizedAttesterResolver internal resolver;
    bytes32 internal schemaUID;
    TRWIV4 internal trwi;
    RegenPrimarySaleV3 internal sale;
    RegenMarketplaceV2 internal market;
    MockERC20 internal usd;

    address internal admin = makeAddr("admin");
    address internal attester = makeAddr("attester");
    address internal withdrawer = makeAddr("withdrawer");
    address internal guardian = makeAddr("guardian");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal creator = makeAddr("creator");
    address internal creatorPayout = makeAddr("creatorPayout");
    address internal partner = makeAddr("partner");
    address internal validator = makeAddr("validator");
    address internal buyer = makeAddr("buyer");
    address internal buyer2 = makeAddr("buyer2");
    address internal stranger = makeAddr("stranger");
    address internal signer;
    uint256 internal signerPk;

    uint256 internal constant IV = 1000 ether;
    uint256 internal constant EDITIONS = 100;
    uint256 internal constant PRICE = 10e6; // 10 USD (6 decimals)
    string internal constant URI = "ipfs://meta1";
    string internal constant METHOD = "v0.2";

    function setUp() public virtual {
        (signer, signerPk) = makeAddrAndKey("signer");
        registry = new SchemaRegistry();
        eas = new EAS(ISchemaRegistry(address(registry)));
        resolver = new AuthorizedAttesterResolver(IEAS(address(eas)), admin);
        schemaUID = registry.register(SCHEMA_V2, ISchemaResolver(address(resolver)), true);
        usd = new MockERC20();

        TRWIV4 impl = new TRWIV4();
        trwi = TRWIV4(
            address(
                new ERC1967Proxy(
                    address(impl), abi.encodeCall(TRWIV4.initialize, (admin, address(eas), schemaUID))
                )
            )
        );
        sale = new RegenPrimarySaleV3(admin, address(trwi), feeRecipient);
        market = new RegenMarketplaceV2(admin, address(trwi), feeRecipient);

        vm.startPrank(admin);
        resolver.grantRole(resolver.ATTESTER_ROLE(), attester);
        trwi.grantRole(trwi.MINTER_ROLE(), address(sale));
        trwi.grantRole(trwi.WITHDRAWER_ROLE(), withdrawer);
        trwi.grantRole(trwi.GUARDIAN_ROLE(), guardian);
        trwi.grantRole(trwi.UPGRADER_ROLE(), admin);
        sale.grantRole(sale.SIGNER_ROLE(), signer);
        sale.grantRole(sale.GUARDIAN_ROLE(), guardian);
        market.grantRole(market.GUARDIAN_ROLE(), guardian);
        sale.setCurrencyAllowed(address(usd), true);
        market.setCurrencyAllowed(address(usd), true);
        vm.stopPrank();
    }

    // ---- attestations ----

    function _claim(address partner_, bool transferable) internal view returns (bytes memory) {
        return abi.encode(creator, IV, URI, uint8(2), METHOD, validator, partner_, transferable);
    }

    function _attestData(bytes memory data) internal returns (bytes32) {
        return _attestData(data, 0);
    }

    function _attestData(bytes memory data, uint64 expiration) internal returns (bytes32 uid) {
        vm.prank(attester);
        uid = eas.attest(
            AttestationRequest({
                schema: schemaUID,
                data: AttestationRequestData({
                    recipient: creator,
                    expirationTime: expiration,
                    revocable: true,
                    refUID: bytes32(0),
                    data: data,
                    value: 0
                })
            })
        );
    }

    function _attest(address partner_) internal returns (bytes32) {
        return _attestData(_claim(partner_, true));
    }

    function _revoke(bytes32 uid) internal {
        vm.prank(attester);
        eas.revoke(RevocationRequest({ schema: schemaUID, data: RevocationRequestData({ uid: uid, value: 0 }) }));
    }

    // ---- vouchers ----

    function _voucher(uint256 tokenId, bytes32 uid, address partner_, uint96 partnerFeeBps)
        internal
        view
        returns (RegenPrimarySaleV3.Voucher memory v)
    {
        v = RegenPrimarySaleV3.Voucher({
            tokenId: tokenId,
            creator: creator,
            totalIV: IV,
            maxEditions: EDITIONS,
            pricePerEdition: PRICE,
            currency: address(usd),
            beneficiary: creatorPayout,
            recipient: address(0),
            easUID: uid,
            metadataURI: URI,
            royaltyBps: 250,
            feeBps: 250,
            partner: partner_,
            partnerFeeBps: partnerFeeBps,
            resaleFeeBps: 250,
            resalePartnerBps: partner_ == address(0) ? 0 : 250,
            mintCap: EDITIONS,
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
    }

    function _sign(RegenPrimarySaleV3.Voucher memory v) internal view returns (bytes memory) {
        return _signWith(v, signerPk);
    }

    function _signWith(RegenPrimarySaleV3.Voucher memory v, uint256 pk) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(pk, sale.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    function _redeem(address payer, RegenPrimarySaleV3.Voucher memory v, uint256 amount) internal {
        bytes memory sig = _sign(v);
        uint256 total = amount * v.pricePerEdition;
        usd.mint(payer, total);
        vm.startPrank(payer);
        usd.approve(address(sale), total);
        sale.redeem(v, amount, sig);
        vm.stopPrank();
    }

    /// @dev Attest + first sale of `amount` editions to `buyer`. Returns the attestation UID.
    function _issue(uint256 tokenId, address partner_, uint256 amount) internal returns (bytes32 uid) {
        uid = _attest(partner_);
        _redeem(buyer, _voucher(tokenId, uid, partner_, partner_ == address(0) ? 0 : 500), amount);
    }

    function _list(address seller, uint256 tokenId, uint256 amount, uint256 price) internal returns (uint256 id) {
        vm.startPrank(seller);
        trwi.setApprovalForAll(address(market), true);
        id = market.list(tokenId, amount, price, address(usd));
        vm.stopPrank();
    }

    function _buyResale(address who, uint256 listingId, uint256 amount, uint256 total) internal {
        usd.mint(who, total);
        vm.startPrank(who);
        usd.approve(address(market), total);
        market.buy(listingId, amount);
        vm.stopPrank();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {REBAZ} from "../src/REBAZ.sol";
import {TRWI} from "../src/TRWI.sol";
import {TRWIStaking} from "../src/TRWIStaking.sol";
import {AuthorizedAttesterResolver} from "../src/AuthorizedAttesterResolver.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {SchemaRegistry} from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import {EAS} from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";

/// @notice End-to-end against a REAL self-deployed EAS (not a mock): attest -> mint tRWI -> stake -> claim,
///         plus the resolver blocking unauthorized attesters.
contract IntegrationTest is Test {
    SchemaRegistry internal registry;
    EAS internal eas;
    AuthorizedAttesterResolver internal resolver;
    REBAZ internal rebaz;
    TRWI internal trwi;
    TRWIStaking internal staking;
    bytes32 internal schemaUID;

    address internal attester = makeAddr("attester");
    address internal badAttester = makeAddr("badAttester");
    address internal ngo = makeAddr("ngo");

    function setUp() public {
        registry = new SchemaRegistry();
        eas = new EAS(ISchemaRegistry(address(registry)));
        resolver = new AuthorizedAttesterResolver(IEAS(address(eas)), address(this));
        schemaUID =
            registry.register("address ngo,uint256 impactValue,string metadataURI", ISchemaResolver(address(resolver)), true);

        rebaz = new REBAZ(address(this), address(this), 0);
        TRWI impl = new TRWI();
        ERC1967Proxy proxy =
            new ERC1967Proxy(address(impl), abi.encodeCall(TRWI.initialize, (address(this), address(eas), schemaUID)));
        trwi = TRWI(address(proxy));
        staking = new TRWIStaking(address(this), address(trwi), address(rebaz), 1000);

        rebaz.grantRole(rebaz.MINTER_ROLE(), address(staking));
        trwi.grantRole(trwi.TOKENIZER_ROLE(), address(this));
        resolver.grantRole(resolver.ATTESTER_ROLE(), attester);
    }

    function _req(address ngo_, uint256 iv, string memory uri) internal view returns (AttestationRequest memory) {
        return AttestationRequest({
            schema: schemaUID,
            data: AttestationRequestData({
                recipient: ngo_,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(ngo_, iv, uri),
                value: 0
            })
        });
    }

    function test_EndToEnd_AttestMintStakeClaim() public {
        // authorized attester creates a real ImpactClaim attestation
        vm.prank(attester);
        bytes32 uid = eas.attest(_req(ngo, 1000 ether, "ipfs://meta"));

        // tokenizer mints fractional editions to the NGO, gated by that attestation
        uint256 id = trwi.mintImpact(uid, 100, address(0), 0);
        assertEq(id, 1);
        assertEq(trwi.balanceOf(ngo, 1), 100);

        // NGO stakes 50 editions for 90 days, accrues + claims REBAZ
        vm.prank(ngo);
        trwi.setApprovalForAll(address(staking), true);
        vm.prank(ngo);
        uint256 sid = staking.stake(1, 50, 90 days);

        vm.warp(block.timestamp + 365 days);
        vm.prank(ngo);
        uint256 reward = staking.claim(sid);
        assertEq(reward, 75 ether); // 500 IV * 10% * 1.5x
        assertEq(rebaz.balanceOf(ngo), 75 ether);
    }

    function test_UnauthorizedAttesterRejected() public {
        vm.prank(badAttester);
        vm.expectRevert(); // resolver.onAttest returns false -> EAS reverts
        eas.attest(_req(ngo, 1 ether, "x"));
    }

    function test_MintRejectsUnknownUID() public {
        vm.expectRevert(TRWI.UID_Unknown.selector);
        trwi.mintImpact(bytes32(uint256(0xdead)), 100, address(0), 0);
    }
}

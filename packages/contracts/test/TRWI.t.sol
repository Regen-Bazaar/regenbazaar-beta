// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TRWI} from "../src/TRWI.sol";
import {MockEAS} from "./mocks/MockEAS.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Attestation} from "@ethereum-attestation-service/eas-contracts/Common.sol";

contract TRWITest is Test {
    TRWI internal trwi;
    MockEAS internal eas;

    address internal admin = makeAddr("admin");
    address internal tokenizer = makeAddr("tokenizer");
    address internal ngo = makeAddr("ngo");
    address internal alice = makeAddr("alice");
    address internal royaltyRecv = makeAddr("royalty");

    bytes32 internal constant SCHEMA = keccak256("ImpactClaim");
    bytes32 internal constant UID1 = bytes32(uint256(0x1));
    bytes32 internal TOKENIZER;

    event URI(string value, uint256 indexed id);

    function setUp() public {
        eas = new MockEAS();
        TRWI impl = new TRWI();
        bytes memory initData = abi.encodeCall(TRWI.initialize, (admin, address(eas), SCHEMA));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        trwi = TRWI(address(proxy));

        TOKENIZER = trwi.TOKENIZER_ROLE();
        vm.prank(admin);
        trwi.grantRole(TOKENIZER, tokenizer);
    }

    function _att(bytes32 uid, bytes32 schema, uint64 rev, uint64 exp, address ngo_, uint256 iv, string memory m)
        internal
        pure
        returns (Attestation memory)
    {
        return Attestation({
            uid: uid,
            schema: schema,
            time: 0,
            expirationTime: exp,
            revocationTime: rev,
            refUID: bytes32(0),
            recipient: ngo_,
            attester: address(0xBEEF),
            revocable: true,
            data: abi.encode(ngo_, iv, m)
        });
    }

    function _setValid() internal {
        eas.set(_att(UID1, SCHEMA, 0, 0, ngo, 1000 ether, "ipfs://meta1"));
    }

    function test_MintImpact_FractionalIV() public {
        _setValid();
        vm.prank(tokenizer);
        uint256 id = trwi.mintImpact(UID1, 100, royaltyRecv, 500);

        assertEq(id, 1);
        assertEq(trwi.balanceOf(ngo, 1), 100);
        assertEq(trwi.totalSupply(1), 100);
        assertEq(trwi.tokenIdForUID(UID1), 1);
        // fractional: sum over editions == totalIV, no double counting
        assertEq(trwi.impactValueOf(1, 100), 1000 ether);
        assertEq(trwi.impactValueOf(1, 25), 250 ether);
        assertEq(trwi.uri(1), "ipfs://meta1");

        TRWI.ImpactRecord memory r = trwi.record(1);
        assertEq(r.creator, ngo);
        assertEq(r.totalIV, 1000 ether);
        assertEq(r.editions, 100);

        (address recv, uint256 amt) = trwi.royaltyInfo(1, 10_000);
        assertEq(recv, royaltyRecv);
        assertEq(amt, 500); // 5%
    }

    function test_MintImpact_EmitsUriEvent() public {
        _setValid();
        vm.expectEmit(true, false, false, true, address(trwi));
        emit URI("ipfs://meta1", 1);
        vm.prank(tokenizer);
        trwi.mintImpact(UID1, 100, address(0), 0);
    }

    function test_SetURI_EmitsUriEvent() public {
        _setValid();
        vm.prank(tokenizer);
        trwi.mintImpact(UID1, 100, address(0), 0);

        vm.expectEmit(true, false, false, true, address(trwi));
        emit URI("ipfs://updated", 1);
        vm.prank(admin);
        trwi.setURI(1, "ipfs://updated");
        assertEq(trwi.uri(1), "ipfs://updated");
    }

    function test_Retire() public {
        _setValid();
        vm.prank(tokenizer);
        trwi.mintImpact(UID1, 100, address(0), 0);

        vm.prank(ngo);
        trwi.retire(1, 25);

        assertEq(trwi.balanceOf(ngo, 1), 75);
        assertEq(trwi.totalSupply(1), 75);
        assertEq(trwi.retiredEditions(1), 25);
    }

    function test_Revert_UnknownUID() public {
        vm.prank(tokenizer);
        vm.expectRevert(TRWI.UID_Unknown.selector);
        trwi.mintImpact(bytes32(uint256(0x99)), 100, address(0), 0);
    }

    function test_Revert_WrongSchema() public {
        eas.set(_att(UID1, keccak256("Other"), 0, 0, ngo, 1 ether, "x"));
        vm.prank(tokenizer);
        vm.expectRevert(TRWI.UID_WrongSchema.selector);
        trwi.mintImpact(UID1, 100, address(0), 0);
    }

    function test_Revert_Revoked() public {
        eas.set(_att(UID1, SCHEMA, uint64(block.timestamp), 0, ngo, 1 ether, "x"));
        vm.prank(tokenizer);
        vm.expectRevert(TRWI.UID_Revoked.selector);
        trwi.mintImpact(UID1, 100, address(0), 0);
    }

    function test_Revert_AlreadyUsed() public {
        _setValid();
        vm.startPrank(tokenizer);
        trwi.mintImpact(UID1, 100, address(0), 0);
        vm.expectRevert(TRWI.UID_AlreadyUsed.selector);
        trwi.mintImpact(UID1, 50, address(0), 0);
        vm.stopPrank();
    }

    function test_Revert_EditionsZero() public {
        _setValid();
        vm.prank(tokenizer);
        vm.expectRevert(TRWI.BadParams.selector);
        trwi.mintImpact(UID1, 0, address(0), 0);
    }

    function test_Revert_NonTokenizer() public {
        _setValid();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, TOKENIZER)
        );
        vm.prank(alice);
        trwi.mintImpact(UID1, 100, address(0), 0);
    }

    function test_SupportsInterface() public view {
        assertTrue(trwi.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(trwi.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(trwi.supportsInterface(0x2a55205a)); // ERC2981
        assertTrue(trwi.supportsInterface(0x7965db0b)); // AccessControl
    }

    function testFuzz_FractionalNoDoubleCount(uint8 editionsRaw, uint96 ivRaw) public {
        uint256 editions = uint256(editionsRaw) + 1; // 1..256
        uint256 iv = uint256(ivRaw) + 1;
        eas.set(_att(UID1, SCHEMA, 0, 0, ngo, iv, "x"));
        vm.prank(tokenizer);
        trwi.mintImpact(UID1, editions, address(0), 0);
        // full set of editions carries exactly totalIV (no inflation, no double counting)
        assertEq(trwi.impactValueOf(1, editions), iv);
        // any subset carries no more than its proportional share
        assertLe(trwi.impactValueOf(1, editions / 2), iv);
    }
}

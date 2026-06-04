// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { TRWI } from "../src/TRWI.sol";
import { MockEAS } from "./mocks/MockEAS.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@ethereum-attestation-service/eas-contracts/Common.sol";

contract TRWITest is Test {
    TRWI internal trwi;
    MockEAS internal eas;

    address internal admin = makeAddr("admin");
    address internal minter = makeAddr("minter"); // the sale contract
    address internal ngo = makeAddr("ngo");
    address internal buyer = makeAddr("buyer");

    bytes32 internal constant SCHEMA = keccak256("ImpactClaim");
    bytes32 internal constant UID1 = bytes32(uint256(0x1));
    bytes32 internal MINTER;

    event URI(string value, uint256 indexed id);

    function setUp() public {
        eas = new MockEAS();
        TRWI impl = new TRWI();
        trwi = TRWI(
            address(
                new ERC1967Proxy(
                    address(impl), abi.encodeCall(TRWI.initialize, (admin, address(eas), SCHEMA))
                )
            )
        );
        MINTER = trwi.MINTER_ROLE();
        vm.prank(admin);
        trwi.grantRole(MINTER, minter);
        eas.set(_att(UID1, SCHEMA, 0, 0, ngo, 1000 ether, "ipfs://meta1"));
    }

    function _att(
        bytes32 uid,
        bytes32 schema,
        uint64 rev,
        uint64 exp,
        address ngo_,
        uint256 iv,
        string memory m
    ) internal pure returns (Attestation memory) {
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

    function _params(uint256 tokenId, uint256 maxEditions) internal view returns (TRWI.MintParams memory) {
        return TRWI.MintParams({
            tokenId: tokenId,
            creator: ngo,
            totalIV: 1000 ether,
            maxEditions: maxEditions,
            easUID: UID1,
            metadataURI: "ipfs://meta1",
            royaltyBps: 500
        });
    }

    function test_MintRegistersAndMints() public {
        vm.prank(minter);
        trwi.mint(_params(1, 100), buyer, 10);

        assertEq(trwi.balanceOf(buyer, 1), 10);
        assertEq(trwi.totalSupply(1), 10);
        assertEq(trwi.tokenIdForUID(UID1), 1);
        // fractional: denominator = maxEditions N
        assertEq(trwi.impactValueOf(1, 100), 1000 ether);
        assertEq(trwi.impactValueOf(1, 10), 100 ether);
        assertEq(trwi.uri(1), "ipfs://meta1");

        TRWI.Collection memory c = trwi.collection(1);
        assertEq(c.creator, ngo);
        assertEq(c.totalIV, 1000 ether);
        assertEq(c.maxEditions, 100);
        assertEq(c.minted, 10);

        (address recv, uint256 amt) = trwi.royaltyInfo(1, 10_000);
        assertEq(recv, ngo);
        assertEq(amt, 500); // 5%
    }

    function test_LazyMintAccumulatesUpToMax() public {
        vm.startPrank(minter);
        trwi.mint(_params(1, 100), buyer, 60);
        trwi.mint(_params(1, 100), buyer, 40);
        vm.stopPrank();
        assertEq(trwi.collection(1).minted, 100);
        assertEq(trwi.balanceOf(buyer, 1), 100);
    }

    function test_MintEmitsUriOnRegister() public {
        vm.expectEmit(true, false, false, true, address(trwi));
        emit URI("ipfs://meta1", 1);
        vm.prank(minter);
        trwi.mint(_params(1, 100), buyer, 1);
    }

    function test_Retire() public {
        vm.prank(minter);
        trwi.mint(_params(1, 100), buyer, 25);
        vm.prank(buyer);
        trwi.retire(1, 10);
        assertEq(trwi.balanceOf(buyer, 1), 15);
        assertEq(trwi.totalSupply(1), 15);
        assertEq(trwi.retiredEditions(1), 10); // minted 25 - supply 15
    }

    function test_Revert_ExceedsMax() public {
        vm.startPrank(minter);
        trwi.mint(_params(1, 100), buyer, 100);
        vm.expectRevert(TRWI.ExceedsMax.selector);
        trwi.mint(_params(1, 100), buyer, 1);
        vm.stopPrank();
    }

    function test_Revert_NonMinter() public {
        vm.expectRevert();
        trwi.mint(_params(1, 100), buyer, 1);
    }

    function test_Revert_MismatchAttestation() public {
        TRWI.MintParams memory p = _params(1, 100);
        p.totalIV = 999 ether; // != attestation iv (1000)
        vm.prank(minter);
        vm.expectRevert(TRWI.Mismatch.selector);
        trwi.mint(p, buyer, 1);
    }

    function test_Revert_UnknownUID() public {
        TRWI.MintParams memory p = _params(1, 100);
        p.easUID = bytes32(uint256(0x99));
        vm.prank(minter);
        vm.expectRevert(TRWI.UID_Unknown.selector);
        trwi.mint(p, buyer, 1);
    }

    function test_Revert_WrongSchema() public {
        eas.set(_att(UID1, keccak256("Other"), 0, 0, ngo, 1000 ether, "ipfs://meta1"));
        vm.prank(minter);
        vm.expectRevert(TRWI.UID_WrongSchema.selector);
        trwi.mint(_params(1, 100), buyer, 1);
    }

    function test_Revert_Revoked() public {
        eas.set(_att(UID1, SCHEMA, uint64(block.timestamp), 0, ngo, 1000 ether, "ipfs://meta1"));
        vm.prank(minter);
        vm.expectRevert(TRWI.UID_Revoked.selector);
        trwi.mint(_params(1, 100), buyer, 1);
    }

    function test_Revert_UIDReuseAcrossTokens() public {
        vm.startPrank(minter);
        trwi.mint(_params(1, 100), buyer, 1);
        vm.expectRevert(TRWI.UID_AlreadyUsed.selector);
        trwi.mint(_params(2, 100), buyer, 1); // same UID, different tokenId
        vm.stopPrank();
    }

    function test_SupportsInterface() public view {
        assertTrue(trwi.supportsInterface(0xd9b67a26)); // ERC1155
        assertTrue(trwi.supportsInterface(0x2a55205a)); // ERC2981
    }

    // --- hardening ---

    /// M5: a collection cannot be registered with a royalty above MAX_ROYALTY_BPS (10%).
    function test_Revert_RoyaltyTooHigh() public {
        TRWI.MintParams memory p = _params(1, 100);
        p.royaltyBps = 1001; // > MAX_ROYALTY_BPS
        vm.prank(minter);
        vm.expectRevert(TRWI.RoyaltyTooHigh.selector);
        trwi.mint(p, buyer, 1);
    }

    /// M4: pause blocks minting; holders can still retire (exit) while paused.
    function test_Paused_BlocksMint_RetireStillWorks() public {
        bytes32 pauser = trwi.PAUSER_ROLE();
        vm.prank(admin);
        trwi.grantRole(pauser, admin);

        vm.prank(minter);
        trwi.mint(_params(1, 100), buyer, 10);

        vm.prank(admin);
        trwi.pause();

        vm.prank(minter);
        vm.expectRevert(); // EnforcedPause
        trwi.mint(_params(1, 100), buyer, 1);

        vm.prank(buyer);
        trwi.retire(1, 5); // exit still works
        assertEq(trwi.balanceOf(buyer, 1), 5);
    }

    function test_Revert_OnlyPauserCanPause() public {
        vm.prank(buyer);
        vm.expectRevert(); // AccessControlUnauthorizedAccount
        trwi.pause();
    }
}

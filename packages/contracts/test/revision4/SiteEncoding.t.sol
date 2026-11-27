// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";
import { TRWIV4 } from "../../src/revision4/TRWIV4.sol";

/// @dev Signing-format guard (contract-revision.md, section 6). The expected values are what the site's own code
///      (apps/web/src/lib/onchain.ts via scripts/check-revision4-encoding.ts, viem) produces for the same vector.
///      If either side changes one field, this test or that script fails, before any purchase can.
contract SiteEncodingTest is Test {
    address internal constant SALE = 0x00000000000000000000000000000000000Ca1e3;
    bytes32 internal constant SITE_VOUCHER_DIGEST = 0x6bfd130421a1906f0e952819e8313fd163b2d6255a423b365da3b906e70acf41;
    bytes32 internal constant SITE_CLAIM_HASH = 0x492ab7ac6e0cba8713a2b96ece84ef22e10ca314227bfaf30b81f587d808f2d0;

    function _voucher() internal pure returns (RegenPrimarySaleV3.Voucher memory) {
        return RegenPrimarySaleV3.Voucher({
            tokenId: 7,
            creator: 0x1111111111111111111111111111111111111111,
            totalIV: 1234 ether,
            maxEditions: 100,
            pricePerEdition: 10_000_000,
            currency: 0x2222222222222222222222222222222222222222,
            beneficiary: 0x3333333333333333333333333333333333333333,
            recipient: address(0),
            easUID: 0x4444444444444444444444444444444444444444444444444444444444444444,
            metadataURI: "ipfs://bafy-fisherman's \"village\"",
            royaltyBps: 250,
            feeBps: 250,
            partner: 0x5555555555555555555555555555555555555555,
            partnerFeeBps: 500,
            resaleFeeBps: 250,
            resalePartnerBps: 250,
            nonce: 3,
            deadline: 1_900_000_000
        });
    }

    function test_VoucherDigest_MatchesSiteSigner() public {
        vm.chainId(31337);
        deployCodeTo("RegenPrimarySaleV3.sol:RegenPrimarySaleV3", abi.encode(address(1), address(2), address(3)), SALE);
        assertEq(RegenPrimarySaleV3(SALE).hashVoucher(_voucher()), SITE_VOUCHER_DIGEST);
    }

    function test_ClaimEncoding_MatchesSiteAndDecodes() public {
        bytes memory data = abi.encode(
            0x1111111111111111111111111111111111111111,
            uint256(1234 ether),
            "ipfs://bafy-fisherman's \"village\"",
            uint8(2),
            "v0.2",
            0x6666666666666666666666666666666666666666,
            0x5555555555555555555555555555555555555555,
            true
        );
        assertEq(keccak256(data), SITE_CLAIM_HASH);
        TRWIV4 impl = new TRWIV4();
        TRWIV4.Claim memory cl = impl.decodeClaim(data);
        assertEq(cl.partner, 0x5555555555555555555555555555555555555555);
        assertEq(cl.validator, 0x6666666666666666666666666666666666666666);
        assertEq(cl.methodologyVersion, "v0.2");
    }
}

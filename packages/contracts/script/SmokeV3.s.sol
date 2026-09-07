// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import {RegenPrimarySale} from "../src/RegenPrimarySale.sol";
import {TRWI} from "../src/TRWI.sol";

/// @notice Two-phase live smoke for the v3 deployment (sidesteps forge's collect-then-broadcast UID problem).
///         Phase 1 (SMOKE_EAS_UID unset): attest, log the real on-chain UID.
///         Phase 2 (SMOKE_EAS_UID=<uid>): sign a feeBps voucher for that UID, redeem, assert mint == 2.
///         Deployer = ATTESTER + SIGNER + buyer. Run each phase with --broadcast.
contract SmokeV3 is Script {
    IEAS constant EAS = IEAS(0x82448c9c9b95Da5dCe9905F9C59CcCA0DF346df8);
    RegenPrimarySale constant SALE = RegenPrimarySale(0x2b4A3aE4E69771cdf2Fd4e2075A7B3Ab2e0498B2);
    TRWI constant TRWI_ = TRWI(0xA1A10570534681606eF67Bc8DDeda6061Dd8a8f0);
    bytes32 constant SCHEMA = 0xc9c7678fbad9ec95e2ef6f480b10391bb7dcb1df7feec189411a439fd850f64e;
    uint256 constant TOKEN_ID = 1;
    string constant URI = "ipfs://smoke-v3";

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address me = vm.addr(pk);
        bytes32 uid = vm.envOr("SMOKE_EAS_UID", bytes32(0));

        if (uid == bytes32(0)) {
            vm.startBroadcast(pk);
            bytes32 newUid = EAS.attest(
                AttestationRequest({
                    schema: SCHEMA,
                    data: AttestationRequestData({
                        recipient: me,
                        expirationTime: 0,
                        revocable: true,
                        refUID: bytes32(0),
                        data: abi.encode(me, uint256(1000 ether), URI),
                        value: 0
                    })
                })
            );
            vm.stopBroadcast();
            console2.log("PHASE1 attested. Re-run with SMOKE_EAS_UID=");
            console2.logBytes32(newUid);
            return;
        }

        RegenPrimarySale.Voucher memory v = RegenPrimarySale.Voucher({
            tokenId: TOKEN_ID,
            creator: me,
            totalIV: 1000 ether,
            maxEditions: 100,
            pricePerEdition: 0.0005 ether,
            currency: address(0), // NATIVE
            beneficiary: me,
            easUID: uid,
            metadataURI: URI,
            royaltyBps: 500,
            feeBps: 250,
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });

        (uint8 yv, bytes32 r, bytes32 s) = vm.sign(pk, SALE.hashVoucher(v));
        vm.startBroadcast(pk);
        SALE.redeem{value: 0.001 ether}(v, 2, abi.encodePacked(r, s, yv));
        vm.stopBroadcast();

        uint256 bal = TRWI_.balanceOf(me, TOKEN_ID);
        console2.log("PHASE2 balanceOf(buyer)", bal);
        require(bal == 2, "smoke failed: balance != 2");
        console2.log("SMOKE OK: feeBps voucher attested, signed, redeemed, lazily minted on v3");
    }
}

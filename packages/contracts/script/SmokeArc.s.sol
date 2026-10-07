// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";
import { TRWI } from "../src/TRWI.sol";

/// @notice Two-phase live smoke on Arc mainnet, one share paid in USDC (ERC-20, 6 decimals).
///         Phase 1 (SMOKE_EAS_UID unset): attest, log the on-chain UID.
///         Phase 2 (SMOKE_EAS_UID=<uid>): sign voucher, approve USDC, redeem 1 share, assert balance == 1.
///         NOTE: on Arc, phase 2 reverts in forge's local EVM (no USDC blocklist precompile 0x1800..01).
///         Use scripts/arc-mainnet-buy.sh (cast) for the purchase. The UID logged by phase 1 is simulated;
///         take the real one from the Attested event in the broadcast receipt.
///         Env: DEPLOYER_PRIVATE_KEY, ARC_EAS, ARC_SCHEMA_UID, ARC_TRWI, ARC_SALE, ARC_USDC,
///         optional SMOKE_PRICE (USDC base units, default 10000 = 0.01 USDC), SMOKE_URI.
///         Deployer = ATTESTER + SIGNER + buyer + beneficiary, so the USDC returns to the deployer minus nothing
///         (fee recipient defaults to deployer too); only gas is spent.
contract SmokeArc is Script {
    uint256 constant TOKEN_ID = 1;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address me = vm.addr(pk);
        bytes32 uid = vm.envOr("SMOKE_EAS_UID", bytes32(0));
        string memory uri = vm.envOr("SMOKE_URI", string("ipfs://smoke-arc"));

        if (uid == bytes32(0)) {
            vm.startBroadcast(pk);
            bytes32 newUid = IEAS(vm.envAddress("ARC_EAS")).attest(
                AttestationRequest({
                    schema: vm.envBytes32("ARC_SCHEMA_UID"),
                    data: AttestationRequestData({
                        recipient: me,
                        expirationTime: 0,
                        revocable: true,
                        refUID: bytes32(0),
                        data: abi.encode(me, uint256(1000 ether), uri),
                        value: 0
                    })
                })
            );
            vm.stopBroadcast();
            console2.log("PHASE1 attested. Re-run with SMOKE_EAS_UID=");
            console2.logBytes32(newUid);
            return;
        }

        RegenPrimarySale sale = RegenPrimarySale(vm.envAddress("ARC_SALE"));
        TRWI trwi = TRWI(vm.envAddress("ARC_TRWI"));
        address usdc = vm.envAddress("ARC_USDC");
        uint256 price = vm.envOr("SMOKE_PRICE", uint256(10_000));

        RegenPrimarySale.Voucher memory v = RegenPrimarySale.Voucher({
            tokenId: TOKEN_ID,
            creator: me,
            totalIV: 1000 ether,
            maxEditions: 100,
            pricePerEdition: price,
            currency: usdc,
            beneficiary: me,
            easUID: uid,
            metadataURI: uri,
            royaltyBps: 500,
            feeBps: 250,
            partner: address(0),
            partnerFeeBps: 0,
            nonce: sale.currentNonce(TOKEN_ID),
            deadline: block.timestamp + 1 hours
        });

        (uint8 yv, bytes32 r, bytes32 s) = vm.sign(pk, sale.hashVoucher(v));
        vm.startBroadcast(pk);
        IERC20(usdc).approve(address(sale), price);
        sale.redeem(v, 1, abi.encodePacked(r, s, yv));
        vm.stopBroadcast();

        uint256 bal = trwi.balanceOf(me, TOKEN_ID);
        console2.log("PHASE2 balanceOf(buyer)", bal);
        require(bal == 1, "smoke failed: balance != 1");
        console2.log("SMOKE OK: tRWI share bought with USDC on Arc mainnet");
    }
}

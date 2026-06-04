// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SchemaRegistry} from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import {EAS} from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import {ISchemaRegistry} from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import {IEAS} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import {AuthorizedAttesterResolver} from "../src/AuthorizedAttesterResolver.sol";
import {REBAZ} from "../src/REBAZ.sol";
import {TRWI} from "../src/TRWI.sol";
import {TRWIStaking} from "../src/TRWIStaking.sol";
import {RegenMarketplace} from "../src/RegenMarketplace.sol";
import {RegenPrimarySale} from "../src/RegenPrimarySale.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Full Regen Bazaar v2 deploy (platform-issued lazy-mint): EAS + REBAZ + tRWI v2 + staking +
///         primary sale (voucher) + secondary marketplace + roles.
/// @dev    Env: DEPLOYER_PRIVATE_KEY (required). Optional: TREASURY_ADDRESS, REBAZ_INITIAL_SUPPLY,
///         REWARD_RATE_BPS, MARKETPLACE_FEE_BPS. Deployer = admin/operator/signer for beta — split SIGNER vs
///         ATTESTER vs admin onto separate keys / a multisig before mainnet.
contract Deploy is Script {
    string constant IMPACT_CLAIM_SCHEMA = "address ngo,uint256 impactValue,string metadataURI";

    struct Deployed {
        address registry;
        address eas;
        address resolver;
        bytes32 schemaUID;
        address rebaz;
        address trwi;
        address trwiImpl;
        address staking;
        address marketplace;
        address primarySale;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Deployed memory d = _deploy(pk, vm.addr(pk));
        _log(d);
    }

    // Addresses are written straight into the memory struct to keep stack depth low (avoids stack-too-deep).
    function _deploy(uint256 pk, address admin) internal returns (Deployed memory d) {
        address treasury = vm.envOr("TREASURY_ADDRESS", admin);
        uint256 initialSupply = vm.envOr("REBAZ_INITIAL_SUPPLY", uint256(0));
        uint256 rewardRateBps = vm.envOr("REWARD_RATE_BPS", uint256(1000));
        uint96 feeBps = uint96(vm.envOr("MARKETPLACE_FEE_BPS", uint256(250)));

        vm.startBroadcast(pk);

        d.registry = address(new SchemaRegistry());
        d.eas = address(new EAS(ISchemaRegistry(d.registry)));
        d.resolver = address(new AuthorizedAttesterResolver(IEAS(d.eas), admin));
        d.schemaUID = SchemaRegistry(d.registry).register(IMPACT_CLAIM_SCHEMA, ISchemaResolver(d.resolver), true);
        d.rebaz = address(new REBAZ(admin, treasury, initialSupply));
        d.trwiImpl = address(new TRWI());
        d.trwi = address(
            new ERC1967Proxy(d.trwiImpl, abi.encodeCall(TRWI.initialize, (admin, d.eas, d.schemaUID)))
        );
        d.staking = address(new TRWIStaking(admin, d.trwi, d.rebaz, rewardRateBps));
        d.marketplace = address(new RegenMarketplace(admin, d.trwi, admin, feeBps));
        d.primarySale = address(new RegenPrimarySale(admin, d.trwi, admin, feeBps));

        // roles
        REBAZ(d.rebaz).grantRole(REBAZ(d.rebaz).MINTER_ROLE(), d.staking);
        TRWI(d.trwi).grantRole(TRWI(d.trwi).MINTER_ROLE(), d.primarySale);
        TRWI(d.trwi).grantRole(TRWI(d.trwi).MINTER_ROLE(), admin);
        RegenPrimarySale(d.primarySale).grantRole(RegenPrimarySale(d.primarySale).SIGNER_ROLE(), admin);
        AuthorizedAttesterResolver(payable(d.resolver)).grantRole(
            AuthorizedAttesterResolver(payable(d.resolver)).ATTESTER_ROLE(), admin
        );

        vm.stopBroadcast();
    }

    function _log(Deployed memory d) internal pure {
        console2.log("SchemaRegistry        ", d.registry);
        console2.log("EAS                   ", d.eas);
        console2.log("AttesterResolver      ", d.resolver);
        console2.log("ImpactClaim schemaUID ");
        console2.logBytes32(d.schemaUID);
        console2.log("REBAZ                 ", d.rebaz);
        console2.log("TRWI proxy            ", d.trwi);
        console2.log("TRWI impl             ", d.trwiImpl);
        console2.log("TRWIStaking           ", d.staking);
        console2.log("RegenMarketplace      ", d.marketplace);
        console2.log("RegenPrimarySale      ", d.primarySale);
    }
}

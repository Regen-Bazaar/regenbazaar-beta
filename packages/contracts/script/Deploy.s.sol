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
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Full Regen Bazaar core deployment (self-deployed EAS + REBAZ + tRWI + staking + roles).
/// @dev    Env: DEPLOYER_PRIVATE_KEY (required). Optional: TREASURY_ADDRESS, REBAZ_INITIAL_SUPPLY,
///         REWARD_RATE_BPS. The deployer is set as admin so it can wire roles in-script; transfer admin
///         to a multisig as a post-deploy step before mainnet.
contract Deploy is Script {
    string constant IMPACT_CLAIM_SCHEMA = "address ngo,uint256 impactValue,string metadataURI";

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(pk);
        address treasury = vm.envOr("TREASURY_ADDRESS", admin);
        uint256 initialSupply = vm.envOr("REBAZ_INITIAL_SUPPLY", uint256(0));
        uint256 baseRewardRateBps = vm.envOr("REWARD_RATE_BPS", uint256(1000));

        vm.startBroadcast(pk);

        // 1) EAS core
        SchemaRegistry registry = new SchemaRegistry();
        EAS eas = new EAS(ISchemaRegistry(address(registry)));

        // 2) Resolver + ImpactClaim schema (revocable)
        AuthorizedAttesterResolver resolver = new AuthorizedAttesterResolver(IEAS(address(eas)), admin);
        bytes32 schemaUID = registry.register(IMPACT_CLAIM_SCHEMA, ISchemaResolver(address(resolver)), true);

        // 3) REBAZ token
        REBAZ rebaz = new REBAZ(admin, treasury, initialSupply);

        // 4) tRWI (UUPS proxy)
        TRWI trwiImpl = new TRWI();
        ERC1967Proxy trwiProxy = new ERC1967Proxy(
            address(trwiImpl), abi.encodeCall(TRWI.initialize, (admin, address(eas), schemaUID))
        );
        TRWI trwi = TRWI(address(trwiProxy));

        // 5) Staking
        TRWIStaking staking = new TRWIStaking(admin, address(trwi), address(rebaz), baseRewardRateBps);

        // 6) Wire roles
        rebaz.grantRole(rebaz.MINTER_ROLE(), address(staking)); // staking mints rewards
        trwi.grantRole(trwi.TOKENIZER_ROLE(), admin); // backend ops key tokenizes (replace with backend signer)
        resolver.grantRole(resolver.ATTESTER_ROLE(), admin); // initial authorized attester

        vm.stopBroadcast();

        console2.log("SchemaRegistry        ", address(registry));
        console2.log("EAS                   ", address(eas));
        console2.log("AttesterResolver      ", address(resolver));
        console2.log("ImpactClaim schemaUID ");
        console2.logBytes32(schemaUID);
        console2.log("REBAZ                 ", address(rebaz));
        console2.log("TRWI proxy            ", address(trwi));
        console2.log("TRWI impl             ", address(trwiImpl));
        console2.log("TRWIStaking           ", address(staking));
    }
}

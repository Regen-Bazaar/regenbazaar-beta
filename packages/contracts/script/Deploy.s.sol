// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import { EAS } from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import { AuthorizedAttesterResolver } from "../src/AuthorizedAttesterResolver.sol";
import { REBAZ } from "../src/REBAZ.sol";
import { TRWI } from "../src/TRWI.sol";
import { TRWIStaking } from "../src/TRWIStaking.sol";
import { RegenMarketplace } from "../src/RegenMarketplace.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Full Regen Bazaar v2 deploy (platform-issued lazy-mint): EAS + REBAZ + tRWI v2 + staking +
///         primary sale (voucher) + secondary marketplace + roles, with SEPARATED keys.
/// @dev    The deployer bootstraps (holds DEFAULT_ADMIN during the script to wire roles) then grants the
///         operational roles to distinct addresses. Set these envs to separate the trust surface (each
///         defaults to the deployer if unset, preserving single-key testnet behaviour):
///           ADMIN_MULTISIG, SIGNER_ADDR, ATTESTER_ADDR, UPGRADER_ADDR, PAUSER_ADDR, FEE_RECIPIENT,
///           TREASURY_ADDRESS, REBAZ_INITIAL_SUPPLY, REBAZ_CAP, REWARD_RATE_BPS, MARKETPLACE_FEE_BPS.
///         If ADMIN_MULTISIG != deployer AND RENOUNCE_DEPLOYER_ADMIN=true, the deployer hands admin to the
///         multisig and renounces its own admin — the mainnet end-state. NOTE: the deployer EOA is NEVER
///         granted MINTER_ROLE on TRWI (minting is only via RegenPrimarySale).
contract Deploy is Script {
    string constant IMPACT_CLAIM_SCHEMA = "address ngo,uint256 impactValue,string metadataURI";
    uint256 constant DEFAULT_REBAZ_CAP = 1_000_000_000 ether; // 1B REBAZ ceiling (override via REBAZ_CAP)

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

    struct RoleSet {
        address adminMultisig;
        address signer;
        address attester;
        address upgrader;
        address pauser;
        address feeRecipient;
        address treasury;
    }

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        Deployed memory d = _deploy(pk, vm.addr(pk));
        _log(d);
    }

    // Addresses are written straight into the memory struct to keep stack depth low (avoids stack-too-deep).
    function _deploy(uint256 pk, address deployer) internal returns (Deployed memory d) {
        RoleSet memory r = _roles(deployer);
        uint256 initialSupply = vm.envOr("REBAZ_INITIAL_SUPPLY", uint256(0));
        uint256 cap = vm.envOr("REBAZ_CAP", DEFAULT_REBAZ_CAP);
        uint256 rewardRateBps = vm.envOr("REWARD_RATE_BPS", uint256(1000));
        uint96 feeBps = uint96(vm.envOr("MARKETPLACE_FEE_BPS", uint256(250)));

        vm.startBroadcast(pk);

        d.registry = address(new SchemaRegistry());
        d.eas = address(new EAS(ISchemaRegistry(d.registry)));
        d.resolver = address(new AuthorizedAttesterResolver(IEAS(d.eas), deployer));
        d.schemaUID =
            SchemaRegistry(d.registry).register(IMPACT_CLAIM_SCHEMA, ISchemaResolver(d.resolver), true);
        d.rebaz = address(new REBAZ(deployer, r.treasury, initialSupply, cap));
        d.trwiImpl = address(new TRWI());
        d.trwi = address(
            new ERC1967Proxy(d.trwiImpl, abi.encodeCall(TRWI.initialize, (deployer, d.eas, d.schemaUID)))
        );
        d.staking = address(new TRWIStaking(deployer, d.trwi, d.rebaz, rewardRateBps));
        d.marketplace = address(new RegenMarketplace(deployer, d.trwi, r.feeRecipient, feeBps));
        d.primarySale = address(new RegenPrimarySale(deployer, d.trwi, r.feeRecipient));

        _wireRoles(d, r, deployer);

        vm.stopBroadcast();
    }

    function _roles(address deployer) internal view returns (RoleSet memory r) {
        r.adminMultisig = vm.envOr("ADMIN_MULTISIG", deployer);
        r.signer = vm.envOr("SIGNER_ADDR", deployer);
        r.attester = vm.envOr("ATTESTER_ADDR", deployer);
        r.upgrader = vm.envOr("UPGRADER_ADDR", deployer);
        r.pauser = vm.envOr("PAUSER_ADDR", deployer);
        r.feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        r.treasury = vm.envOr("TREASURY_ADDRESS", deployer);
    }

    function _wireRoles(Deployed memory d, RoleSet memory r, address deployer) internal {
        // operational roles (deployer EOA is intentionally NOT a TRWI minter)
        REBAZ(d.rebaz).grantRole(REBAZ(d.rebaz).MINTER_ROLE(), d.staking);
        TRWI(d.trwi).grantRole(TRWI(d.trwi).MINTER_ROLE(), d.primarySale);
        TRWI(d.trwi).grantRole(TRWI(d.trwi).UPGRADER_ROLE(), r.upgrader);
        TRWI(d.trwi).grantRole(TRWI(d.trwi).PAUSER_ROLE(), r.pauser);
        RegenPrimarySale(d.primarySale).grantRole(RegenPrimarySale(d.primarySale).SIGNER_ROLE(), r.signer);
        RegenPrimarySale(d.primarySale).grantRole(RegenPrimarySale(d.primarySale).PAUSER_ROLE(), r.pauser);
        RegenMarketplace(d.marketplace).grantRole(RegenMarketplace(d.marketplace).PAUSER_ROLE(), r.pauser);
        TRWIStaking(d.staking).grantRole(TRWIStaking(d.staking).PAUSER_ROLE(), r.pauser);
        AuthorizedAttesterResolver(payable(d.resolver))
            .grantRole(AuthorizedAttesterResolver(payable(d.resolver)).ATTESTER_ROLE(), r.attester);

        // optional admin handoff to a multisig (mainnet end-state). Guarded so testnet runs are unaffected.
        if (r.adminMultisig != deployer) {
            _grantAdmin(d, r.adminMultisig);
            if (vm.envOr("RENOUNCE_DEPLOYER_ADMIN", false)) _renounceAdmin(d, deployer);
        }
    }

    function _grantAdmin(Deployed memory d, address to) internal {
        TRWI(d.trwi).grantRole(0x00, to); // DEFAULT_ADMIN_ROLE
        REBAZ(d.rebaz).grantRole(0x00, to);
        TRWIStaking(d.staking).grantRole(0x00, to);
        TRWIStaking(d.staking).grantRole(TRWIStaking(d.staking).ADMIN_ROLE(), to);
        RegenMarketplace(d.marketplace).grantRole(0x00, to);
        RegenMarketplace(d.marketplace).grantRole(RegenMarketplace(d.marketplace).ADMIN_ROLE(), to);
        RegenPrimarySale(d.primarySale).grantRole(0x00, to);
        RegenPrimarySale(d.primarySale).grantRole(RegenPrimarySale(d.primarySale).ADMIN_ROLE(), to);
        AuthorizedAttesterResolver(payable(d.resolver)).grantRole(0x00, to);
    }

    function _renounceAdmin(Deployed memory d, address deployer) internal {
        TRWI(d.trwi).renounceRole(0x00, deployer);
        REBAZ(d.rebaz).renounceRole(0x00, deployer);
        TRWIStaking(d.staking).renounceRole(TRWIStaking(d.staking).ADMIN_ROLE(), deployer);
        TRWIStaking(d.staking).renounceRole(0x00, deployer);
        RegenMarketplace(d.marketplace).renounceRole(RegenMarketplace(d.marketplace).ADMIN_ROLE(), deployer);
        RegenMarketplace(d.marketplace).renounceRole(0x00, deployer);
        RegenPrimarySale(d.primarySale).renounceRole(RegenPrimarySale(d.primarySale).ADMIN_ROLE(), deployer);
        RegenPrimarySale(d.primarySale).renounceRole(0x00, deployer);
        AuthorizedAttesterResolver(payable(d.resolver)).renounceRole(0x00, deployer);
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

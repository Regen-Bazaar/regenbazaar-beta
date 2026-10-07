// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import { EAS } from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import { AuthorizedAttesterResolver } from "../src/AuthorizedAttesterResolver.sol";
import { TRWI } from "../src/TRWI.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Market-only deploy for Arc mainnet: EAS (Arc has none) + resolver + tRWI + RegenPrimarySale v2,
///         USDC ERC-20 allowlisted. NO REBAZ, NO staking, NO secondary marketplace (owner decision).
///         Deploy.s.sol is untouched and stays the full testnet deploy.
///         Env: DEPLOYER_PRIVATE_KEY, optional SIGNER_ADDR / ATTESTER_ADDR / UPGRADER_ADDR / PAUSER_ADDR /
///         FEE_RECIPIENT (default: deployer), ARC_USDC (default: Arc mainnet USDC ERC-20 interface).
contract DeployArcMarket is Script {
    string constant IMPACT_CLAIM_SCHEMA = "address ngo,uint256 impactValue,string metadataURI";
    // docs.arc.io/arc/references/contract-addresses (6-decimals ERC-20 view of native USDC)
    address constant ARC_MAINNET_USDC = 0x3600000000000000000000000000000000000000;
    uint256 constant ARC_MAINNET_CHAIN_ID = 5042;

    struct Deployed {
        address registry;
        address eas;
        address resolver;
        bytes32 schemaUID;
        address trwi;
        address trwiImpl;
        address primarySale;
        address usdc;
    }

    function run() external {
        require(block.chainid == ARC_MAINNET_CHAIN_ID, "not Arc mainnet");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        Deployed memory d;
        d.usdc = vm.envOr("ARC_USDC", ARC_MAINNET_USDC);

        vm.startBroadcast(pk);
        d.registry = address(new SchemaRegistry());
        d.eas = address(new EAS(ISchemaRegistry(d.registry)));
        d.resolver = address(new AuthorizedAttesterResolver(IEAS(d.eas), deployer));
        d.schemaUID =
            SchemaRegistry(d.registry).register(IMPACT_CLAIM_SCHEMA, ISchemaResolver(d.resolver), true);
        d.trwiImpl = address(new TRWI());
        d.trwi = address(
            new ERC1967Proxy(d.trwiImpl, abi.encodeCall(TRWI.initialize, (deployer, d.eas, d.schemaUID)))
        );
        d.primarySale = address(new RegenPrimarySale(deployer, d.trwi, vm.envOr("FEE_RECIPIENT", deployer)));
        RegenPrimarySale(d.primarySale).setCurrencyAllowed(d.usdc, true);
        _wireRoles(d, deployer);
        vm.stopBroadcast();

        _log(d);
    }

    function _wireRoles(Deployed memory d, address deployer) internal {
        TRWI t = TRWI(d.trwi);
        RegenPrimarySale s = RegenPrimarySale(d.primarySale);
        AuthorizedAttesterResolver res = AuthorizedAttesterResolver(payable(d.resolver));
        address pauser = vm.envOr("PAUSER_ADDR", deployer);
        // deployer EOA is intentionally NOT a TRWI minter (minting only via RegenPrimarySale)
        t.grantRole(t.MINTER_ROLE(), d.primarySale);
        t.grantRole(t.UPGRADER_ROLE(), vm.envOr("UPGRADER_ADDR", deployer));
        t.grantRole(t.PAUSER_ROLE(), pauser);
        s.grantRole(s.SIGNER_ROLE(), vm.envOr("SIGNER_ADDR", deployer));
        s.grantRole(s.PAUSER_ROLE(), pauser);
        res.grantRole(res.ATTESTER_ROLE(), vm.envOr("ATTESTER_ADDR", deployer));
    }

    function _log(Deployed memory d) internal pure {
        console2.log("SchemaRegistry        ", d.registry);
        console2.log("EAS                   ", d.eas);
        console2.log("AttesterResolver      ", d.resolver);
        console2.log("ImpactClaim schemaUID ");
        console2.logBytes32(d.schemaUID);
        console2.log("TRWI proxy            ", d.trwi);
        console2.log("TRWI impl             ", d.trwiImpl);
        console2.log("RegenPrimarySale v2   ", d.primarySale);
        console2.log("USDC allowlisted      ", d.usdc);
    }
}

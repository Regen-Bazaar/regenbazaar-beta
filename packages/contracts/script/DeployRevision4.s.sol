// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/resolver/ISchemaResolver.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { AuthorizedAttesterResolver } from "../src/AuthorizedAttesterResolver.sol";
import { TRWIV4 } from "../src/revision4/TRWIV4.sol";
import { RegenPrimarySaleV3 } from "../src/revision4/RegenPrimarySaleV3.sol";
import { RegenMarketplaceV2 } from "../src/revision4/RegenMarketplaceV2.sol";
import { TestUSDG } from "../src/testnet/TestUSDG.sol";

/// @notice Contract revision 4: deploys timelock, attester resolver, ImpactClaim v2 schema (on the EXISTING
///         EAS + SchemaRegistry), TRWIV4 (UUPS proxy), RegenPrimarySaleV3, RegenMarketplaceV2, and hands every
///         right over. After the run the deployer holds no role on any contract.
///         Roles after handover:
///           timelock      DEFAULT_ADMIN on all four + UPGRADER on TRWIV4 (proposer/executor = ADMIN_ADDRESS)
///           SIGNER        voucher signer on the sale         ATTESTER   attester on the resolver
///           WITHDRAWER    withdraw on TRWIV4                 GUARDIAN   pause (not unpause) on all three
///           FEE_RECIPIENT Regen Bazaar's share, sale + marketplace
///         REBAZ and TRWIStaking are not part of the revision (owner, 16.11.2026).
/// @dev    Env (addresses only; the deployer key is read by forge, never logged):
///           DEPLOYER_PRIVATE_KEY, EAS_ADDRESS, SCHEMA_REGISTRY_ADDRESS, ADMIN_ADDRESS, TIMELOCK_DELAY (seconds),
///           SIGNER_ADDRESS, ATTESTER_ADDRESS, WITHDRAWER_ADDRESS, GUARDIAN_ADDRESS, FEE_RECIPIENT,
///           ALLOWED_CURRENCIES (comma-separated stablecoins), DEPLOY_TEST_STABLECOIN (true on a network
///           with no official test stablecoin: deploys the labelled TestUSDG stand-in and allows it).
///         ALLOWED_CURRENCIES per network (owner decision 28.11.2026; Circle USDC from
///         developers.circle.com/stablecoins/usdc-contract-addresses), DEPLOY_TEST_STABLECOIN=false on both:
///           Arbitrum Sepolia: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d (USDC)
///           Celo Sepolia:     0x01C5C0122039549AD1493B8220cABEdD739BC44E (USDC),
///                             0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b (USDm, Celo dollar, 18 decimals)
contract DeployRevision4 is Script {
    string public constant IMPACT_CLAIM_V2_SCHEMA =
        "address creator,uint256 impactValue,string metadataURI,uint8 proofLevel,string methodologyVersion,address validator,address partner,bool transferable";

    struct Config {
        address eas;
        address schemaRegistry;
        address admin;
        uint256 timelockDelay;
        address signer;
        address attester;
        address withdrawer;
        address guardian;
        address feeRecipient;
        address[] currencies;
        bool deployTestStablecoin;
    }

    struct Deployed {
        address timelock;
        address resolver;
        bytes32 schemaUID;
        address trwi;
        address trwiImpl;
        address primarySale;
        address marketplace;
        address testStablecoin;
    }

    error BadConfig(string what);

    function run() external returns (Deployed memory d) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        Config memory c = configFromEnv();
        validate(c, deployer);
        vm.startBroadcast(pk);
        d = _deploy(c, deployer);
        vm.stopBroadcast();
        _log(c, d, deployer);
    }

    function configFromEnv() public view returns (Config memory c) {
        c.eas = vm.envAddress("EAS_ADDRESS");
        c.schemaRegistry = vm.envAddress("SCHEMA_REGISTRY_ADDRESS");
        c.admin = vm.envAddress("ADMIN_ADDRESS");
        c.timelockDelay = vm.envUint("TIMELOCK_DELAY");
        c.signer = vm.envAddress("SIGNER_ADDRESS");
        c.attester = vm.envAddress("ATTESTER_ADDRESS");
        c.withdrawer = vm.envAddress("WITHDRAWER_ADDRESS");
        c.guardian = vm.envAddress("GUARDIAN_ADDRESS");
        c.feeRecipient = vm.envAddress("FEE_RECIPIENT");
        c.currencies = vm.envOr("ALLOWED_CURRENCIES", ",", new address[](0));
        c.deployTestStablecoin = vm.envOr("DEPLOY_TEST_STABLECOIN", false);
    }

    /// @notice Refuse a config that would leave the deployer with rights or a role unassigned.
    function validate(Config memory c, address deployer) public view {
        if (c.eas.code.length == 0) revert BadConfig("EAS_ADDRESS has no code");
        if (c.schemaRegistry.code.length == 0) revert BadConfig("SCHEMA_REGISTRY_ADDRESS has no code");
        if (address(IEAS(c.eas).getSchemaRegistry()) != c.schemaRegistry) {
            revert BadConfig("EAS uses another SchemaRegistry");
        }
        if (c.timelockDelay == 0) revert BadConfig("TIMELOCK_DELAY is 0");
        address[6] memory holders = [c.admin, c.signer, c.attester, c.withdrawer, c.guardian, c.feeRecipient];
        for (uint256 i = 0; i < holders.length; ++i) {
            if (holders[i] == address(0)) revert BadConfig("role holder is zero");
            if (holders[i] == deployer) revert BadConfig("role holder is the deployer");
            for (uint256 j = 0; j < i; ++j) {
                if (holders[i] == holders[j]) revert BadConfig("two roles share one key");
            }
        }
        if (c.currencies.length == 0 && !c.deployTestStablecoin) revert BadConfig("no stablecoin");
        if (c.deployTestStablecoin && !isTestNetwork(block.chainid)) revert BadConfig("test stablecoin on a non-test chain");
        for (uint256 i = 0; i < c.currencies.length; ++i) {
            if (c.currencies[i].code.length == 0) revert BadConfig("currency has no code");
            if (!_isStablecoin(c.currencies[i])) revert BadConfig("currency is not an ERC-20 stablecoin (6..18 decimals)");
        }
    }

    /// @notice Networks where the labelled, publicly mintable TestUSDG stand-in may ever be deployed.
    function isTestNetwork(uint256 chainId) public pure returns (bool) {
        return chainId == 421614 || chainId == 11142220 || chainId == 46630 || chainId == 31337;
    }

    /// @dev The address answers the ERC-20 reads the sale and marketplace rely on, with 6..18 decimals.
    function _isStablecoin(address token) internal view returns (bool) {
        (bool ok, bytes memory ret) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (!ok || ret.length != 32) return false;
        uint256 dec = abi.decode(ret, (uint256));
        if (dec < 6 || dec > 18) return false;
        (ok, ret) = token.staticcall(abi.encodeWithSignature("totalSupply()"));
        if (!ok || ret.length != 32) return false;
        (ok, ret) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        return ok && ret.length == 32;
    }

    /// @dev Must run inside a broadcast (or prank) as `deployer`. Public so the tests run the same code.
    function deployAs(Config memory c, address deployer) external returns (Deployed memory d) {
        validate(c, deployer);
        vm.startBroadcast(deployer);
        d = _deploy(c, deployer);
        vm.stopBroadcast();
    }

    function _deploy(Config memory c, address deployer) internal returns (Deployed memory d) {
        address[] memory admins = new address[](1);
        admins[0] = c.admin;
        // Self-administered timelock (admin = 0): only ADMIN_ADDRESS proposes, executes and cancels.
        d.timelock = address(new TimelockController(c.timelockDelay, admins, admins, address(0)));

        d.resolver = address(new AuthorizedAttesterResolver(IEAS(c.eas), deployer));
        d.schemaUID = ISchemaRegistry(c.schemaRegistry)
            .register(IMPACT_CLAIM_V2_SCHEMA, ISchemaResolver(d.resolver), true);

        d.trwiImpl = address(new TRWIV4());
        d.trwi = address(
            new ERC1967Proxy(d.trwiImpl, abi.encodeCall(TRWIV4.initialize, (deployer, c.eas, d.schemaUID)))
        );
        d.primarySale = address(new RegenPrimarySaleV3(deployer, d.trwi, c.feeRecipient));
        d.marketplace = address(new RegenMarketplaceV2(deployer, d.trwi, c.feeRecipient));

        if (c.deployTestStablecoin) {
            d.testStablecoin = address(new TestUSDG());
            _allow(d, d.testStablecoin);
        }
        for (uint256 i = 0; i < c.currencies.length; ++i) {
            _allow(d, c.currencies[i]);
        }

        _grantOperational(c, d);
        _handOver(d, deployer);
    }

    function _allow(Deployed memory d, address currency) internal {
        RegenPrimarySaleV3(d.primarySale).setCurrencyAllowed(currency, true);
        RegenMarketplaceV2(d.marketplace).setCurrencyAllowed(currency, true);
    }

    function _grantOperational(Config memory c, Deployed memory d) internal {
        TRWIV4 t = TRWIV4(d.trwi);
        t.grantRole(t.MINTER_ROLE(), d.primarySale);
        t.grantRole(t.WITHDRAWER_ROLE(), c.withdrawer);
        t.grantRole(t.GUARDIAN_ROLE(), c.guardian);
        t.grantRole(t.UPGRADER_ROLE(), d.timelock);

        RegenPrimarySaleV3 s = RegenPrimarySaleV3(d.primarySale);
        s.grantRole(s.SIGNER_ROLE(), c.signer);
        s.grantRole(s.GUARDIAN_ROLE(), c.guardian);

        RegenMarketplaceV2 m = RegenMarketplaceV2(d.marketplace);
        m.grantRole(m.GUARDIAN_ROLE(), c.guardian);

        AuthorizedAttesterResolver r = AuthorizedAttesterResolver(payable(d.resolver));
        r.grantRole(r.ATTESTER_ROLE(), c.attester);
    }

    /// @dev Timelock becomes DEFAULT_ADMIN everywhere, then the deployer renounces. Order matters: grant first.
    function _handOver(Deployed memory d, address deployer) internal {
        bytes32 admin = 0x00;
        TRWIV4(d.trwi).grantRole(admin, d.timelock);
        RegenPrimarySaleV3(d.primarySale).grantRole(admin, d.timelock);
        RegenMarketplaceV2(d.marketplace).grantRole(admin, d.timelock);
        AuthorizedAttesterResolver(payable(d.resolver)).grantRole(admin, d.timelock);

        TRWIV4(d.trwi).renounceRole(admin, deployer);
        RegenPrimarySaleV3(d.primarySale).renounceRole(admin, deployer);
        RegenMarketplaceV2(d.marketplace).renounceRole(admin, deployer);
        AuthorizedAttesterResolver(payable(d.resolver)).renounceRole(admin, deployer);
    }

    function _log(Config memory c, Deployed memory d, address deployer) internal pure {
        console2.log("deployer (no rights left)", deployer);
        console2.log("TimelockController       ", d.timelock);
        console2.log("  delay (s)              ", c.timelockDelay);
        console2.log("  proposer/executor      ", c.admin);
        console2.log("AttesterResolver         ", d.resolver);
        console2.log("ImpactClaim v2 schemaUID ");
        console2.logBytes32(d.schemaUID);
        console2.log("TRWIV4 proxy             ", d.trwi);
        console2.log("TRWIV4 impl              ", d.trwiImpl);
        console2.log("RegenPrimarySaleV3       ", d.primarySale);
        console2.log("RegenMarketplaceV2       ", d.marketplace);
        if (d.testStablecoin != address(0)) console2.log("TestUSDG (stand-in)      ", d.testStablecoin);
        console2.log("signer                   ", c.signer);
        console2.log("attester                 ", c.attester);
        console2.log("withdrawer               ", c.withdrawer);
        console2.log("guardian                 ", c.guardian);
        console2.log("feeRecipient             ", c.feeRecipient);
    }
}

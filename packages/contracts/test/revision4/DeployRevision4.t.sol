// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-contracts/SchemaRegistry.sol";
import { EAS } from "@ethereum-attestation-service/eas-contracts/EAS.sol";
import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/ISchemaRegistry.sol";
import {
    IEAS,
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";

import { DeployRevision4 } from "../../script/DeployRevision4.s.sol";
import { AuthorizedAttesterResolver } from "../../src/AuthorizedAttesterResolver.sol";
import { TRWIV4 } from "../../src/revision4/TRWIV4.sol";
import { RegenPrimarySaleV3 } from "../../src/revision4/RegenPrimarySaleV3.sol";
import { RegenMarketplaceV2 } from "../../src/revision4/RegenMarketplaceV2.sol";
import { TestUSDG } from "../../src/testnet/TestUSDG.sol";

/// @dev Runs the real deploy script (same code path as `forge script`), then proves the handover:
///      every role holder, deployer without rights, admin only through the timelock and only after the
///      delay, and one full cycle (attest, buy with split, resell with split, retire with statement,
///      withdraw + revoke a false claim). Shared by the local test and the fork tests.
abstract contract DeployRevision4Checks is Test {
    DeployRevision4 internal script;
    DeployRevision4.Config internal cfg;
    DeployRevision4.Deployed internal d;
    address internal deployer = makeAddr("deployer");
    address internal adminWallet = makeAddr("adminWallet");
    address internal signer;
    uint256 internal signerPk;
    address internal attester = makeAddr("attesterKey");
    address internal withdrawer = makeAddr("withdrawerKey");
    address internal guardian = makeAddr("guardianKey");
    address internal feeRecipient = makeAddr("treasury");
    uint256 internal constant DELAY = 300; // minutes on test networks

    function _config(address eas, address registry) internal returns (DeployRevision4.Config memory c) {
        (signer, signerPk) = makeAddrAndKey("signerKey");
        c.eas = eas;
        c.schemaRegistry = registry;
        c.admin = adminWallet;
        c.timelockDelay = DELAY;
        c.signer = signer;
        c.attester = attester;
        c.withdrawer = withdrawer;
        c.guardian = guardian;
        c.feeRecipient = feeRecipient;
        c.currencies = new address[](0);
        c.deployTestStablecoin = true;
    }

    function _deploy(DeployRevision4.Config memory c) internal {
        script = new DeployRevision4();
        cfg = c;
        d = script.deployAs(c, deployer);
    }

    // ---- role checks ----

    function _checkRoles() internal view {
        TRWIV4 t = TRWIV4(d.trwi);
        RegenPrimarySaleV3 s = RegenPrimarySaleV3(d.primarySale);
        RegenMarketplaceV2 m = RegenMarketplaceV2(d.marketplace);
        AuthorizedAttesterResolver r = AuthorizedAttesterResolver(payable(d.resolver));
        TimelockController tl = TimelockController(payable(d.timelock));
        bytes32 a = 0x00;

        assertTrue(t.hasRole(a, d.timelock));
        assertTrue(s.hasRole(a, d.timelock));
        assertTrue(m.hasRole(a, d.timelock));
        assertTrue(r.hasRole(a, d.timelock));
        assertTrue(t.hasRole(t.UPGRADER_ROLE(), d.timelock));
        assertTrue(t.hasRole(t.MINTER_ROLE(), d.primarySale));
        assertTrue(t.hasRole(t.WITHDRAWER_ROLE(), withdrawer));
        assertTrue(t.hasRole(t.GUARDIAN_ROLE(), guardian));
        assertTrue(s.hasRole(s.SIGNER_ROLE(), signer));
        assertTrue(s.hasRole(s.GUARDIAN_ROLE(), guardian));
        assertTrue(m.hasRole(m.GUARDIAN_ROLE(), guardian));
        assertTrue(r.hasRole(r.ATTESTER_ROLE(), attester));
        assertEq(s.feeRecipient(), feeRecipient);
        assertEq(m.feeRecipient(), feeRecipient);
        assertEq(address(s.trwi()), d.trwi);
        assertEq(address(m.trwi()), d.trwi);
        assertEq(address(t.eas()), cfg.eas);
        assertEq(t.impactClaimSchema(), d.schemaUID);
        assertTrue(s.allowedCurrency(d.testStablecoin));
        assertTrue(m.allowedCurrency(d.testStablecoin));

        // timelock: only the admin wallet proposes/executes/cancels; nobody administers it but itself
        assertEq(tl.getMinDelay(), DELAY);
        assertTrue(tl.hasRole(tl.PROPOSER_ROLE(), adminWallet));
        assertTrue(tl.hasRole(tl.EXECUTOR_ROLE(), adminWallet));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), adminWallet));
        assertTrue(tl.hasRole(a, d.timelock));
        assertFalse(tl.hasRole(a, adminWallet));

        // the deployer has no rights left anywhere
        bytes32[4] memory tRoles = [a, t.MINTER_ROLE(), t.UPGRADER_ROLE(), t.WITHDRAWER_ROLE()];
        for (uint256 i = 0; i < tRoles.length; ++i) {
            assertFalse(t.hasRole(tRoles[i], deployer));
        }
        assertFalse(t.hasRole(t.GUARDIAN_ROLE(), deployer));
        assertFalse(s.hasRole(a, deployer));
        assertFalse(s.hasRole(s.SIGNER_ROLE(), deployer));
        assertFalse(s.hasRole(s.GUARDIAN_ROLE(), deployer));
        assertFalse(m.hasRole(a, deployer));
        assertFalse(m.hasRole(m.GUARDIAN_ROLE(), deployer));
        assertFalse(r.hasRole(a, deployer));
        assertFalse(r.hasRole(r.ATTESTER_ROLE(), deployer));
        assertFalse(tl.hasRole(a, deployer));
        assertFalse(tl.hasRole(tl.PROPOSER_ROLE(), deployer));
        assertFalse(tl.hasRole(tl.EXECUTOR_ROLE(), deployer));
        // no admin key holds an operational role either
        assertFalse(t.hasRole(a, adminWallet));
        assertFalse(s.hasRole(a, adminWallet));
    }

    function _checkDeployerCannotAct() internal {
        vm.startPrank(deployer);
        vm.expectRevert();
        RegenPrimarySaleV3(d.primarySale).setFeeRecipient(deployer);
        vm.expectRevert();
        TRWIV4(d.trwi).grantRole(0x00, deployer);
        vm.expectRevert();
        TRWIV4(d.trwi).pause();
        vm.expectRevert();
        RegenMarketplaceV2(d.marketplace).setCurrencyAllowed(deployer, true);
        vm.expectRevert();
        AuthorizedAttesterResolver(payable(d.resolver)).grantRole(keccak256("ATTESTER_ROLE"), deployer);
        vm.stopPrank();
    }

    /// Admin acts only through the timelock, and only after the delay.
    function _checkTimelock() internal {
        RegenPrimarySaleV3 s = RegenPrimarySaleV3(d.primarySale);
        TimelockController tl = TimelockController(payable(d.timelock));
        address newRecipient = makeAddr("newTreasury");

        vm.expectRevert();
        vm.prank(adminWallet);
        s.setFeeRecipient(newRecipient); // direct call: admin wallet is not the contract admin

        bytes memory data = abi.encodeCall(RegenPrimarySaleV3.setFeeRecipient, (newRecipient));
        vm.expectRevert();
        vm.prank(guardian);
        tl.schedule(address(s), 0, data, bytes32(0), bytes32("1"), DELAY);

        vm.prank(adminWallet);
        tl.schedule(address(s), 0, data, bytes32(0), bytes32("1"), DELAY);
        vm.expectRevert(); // before the delay
        vm.prank(adminWallet);
        tl.execute(address(s), 0, data, bytes32(0), bytes32("1"));

        vm.warp(block.timestamp + DELAY);
        vm.expectRevert(); // only the admin wallet executes
        vm.prank(guardian);
        tl.execute(address(s), 0, data, bytes32(0), bytes32("1"));
        vm.prank(adminWallet);
        tl.execute(address(s), 0, data, bytes32(0), bytes32("1"));
        assertEq(s.feeRecipient(), newRecipient);

        // put it back for the cycle
        data = abi.encodeCall(RegenPrimarySaleV3.setFeeRecipient, (feeRecipient));
        _timelocked(address(s), data, "2");
    }

    function _timelocked(address target, bytes memory data, bytes32 salt) internal {
        TimelockController tl = TimelockController(payable(d.timelock));
        vm.prank(adminWallet);
        tl.schedule(target, 0, data, bytes32(0), salt, DELAY);
        vm.warp(block.timestamp + DELAY);
        vm.prank(adminWallet);
        tl.execute(target, 0, data, bytes32(0), salt);
    }

    // ---- full cycle ----

    address internal creator = makeAddr("cycleCreator");
    address internal partner = makeAddr("cyclePartner");
    address internal buyer = makeAddr("cycleBuyer");
    address internal buyer2 = makeAddr("cycleBuyer2");

    function _cycle() internal {
        _cycleSales();
        _cycleWithdraw();
        _cycleAdmin();
    }

    function _cycleSales() internal {
        TRWIV4 t = TRWIV4(d.trwi);
        TestUSDG usd = TestUSDG(d.testStablecoin);

        // attest: only the attester key may write the new format
        bytes memory claim = abi.encode(creator, 1000 ether, "ipfs://cycle", uint8(3), "v0.2", address(0), partner, true);
        vm.expectRevert();
        vm.prank(signer);
        _attest(claim, creator);
        vm.prank(attester);
        bytes32 uid = _attest(claim, creator);

        // buy with split (100 tUSDG for 10 editions, partner 5%)
        RegenPrimarySaleV3.Voucher memory v = _voucher(uid, creator, partner, "ipfs://cycle");
        _fund(usd, buyer, 100e6);
        vm.prank(buyer);
        usd.approve(d.primarySale, 100e6);
        bytes memory sig = _sign(v);
        vm.prank(buyer);
        RegenPrimarySaleV3(d.primarySale).redeem(v, 10, sig);
        assertEq(t.balanceOf(buyer, 1), 10);
        assertEq(usd.balanceOf(feeRecipient), 2_500_000);
        assertEq(usd.balanceOf(partner), 5_000_000);
        assertEq(usd.balanceOf(creator), 92_500_000);

        // resell with split (4 editions at 25 tUSDG = 100)
        vm.startPrank(buyer);
        t.setApprovalForAll(d.marketplace, true);
        uint256 id = RegenMarketplaceV2(d.marketplace).list(1, 4, 25e6, d.testStablecoin);
        vm.stopPrank();
        _fund(usd, buyer2, 100e6);
        vm.startPrank(buyer2);
        usd.approve(d.marketplace, 100e6);
        RegenMarketplaceV2(d.marketplace).buy(id, 4);
        vm.stopPrank();
        assertEq(usd.balanceOf(buyer), 92_500_000, "seller 92.5%");
        assertEq(usd.balanceOf(creator), 95_000_000, "creator +2.5%");
        assertEq(usd.balanceOf(partner), 7_500_000, "partner +2.5%");
        assertEq(usd.balanceOf(feeRecipient), 5_000_000, "platform +2.5%");
        assertEq(usd.balanceOf(d.primarySale) + usd.balanceOf(d.marketplace), 0);

        // retire with statement
        vm.prank(buyer2);
        uint256 sid = t.retire(1, 2, "Cycle Co");
        assertEq(t.statement(sid).impactValue, 20 ether);
        assertEq(t.retiredBy(1, buyer2), 2);
    }

    function _cycleWithdraw() internal {
        TRWIV4 t = TRWIV4(d.trwi);
        TestUSDG usd = TestUSDG(d.testStablecoin);
        // withdraw a false claim (second impact): withdrawer marks, attester revokes in EAS
        vm.prank(attester);
        bytes32 uid2 = _attest(
            abi.encode(creator, 500 ether, "ipfs://false", uint8(1), "v0.2", address(0), address(0), true), creator
        );
        vm.prank(withdrawer);
        t.withdraw(uid2, "ipfs://reason");
        vm.prank(attester);
        IEAS(cfg.eas).revoke(RevocationRequest({ schema: d.schemaUID, data: RevocationRequestData({ uid: uid2, value: 0 }) }));
        RegenPrimarySaleV3.Voucher memory v2 = _voucher(uid2, creator, address(0), "ipfs://false");
        v2.tokenId = 2;
        v2.totalIV = 500 ether;
        v2.partnerFeeBps = 0;
        v2.resalePartnerBps = 0;
        _fund(usd, buyer, 10e6);
        vm.prank(buyer);
        usd.approve(d.primarySale, 10e6);
        bytes memory sig2 = _sign(v2);
        vm.expectRevert(TRWIV4.ImpactIsWithdrawn.selector);
        vm.prank(buyer);
        RegenPrimarySaleV3(d.primarySale).redeem(v2, 1, sig2);

        // reinstate only through the timelock
        vm.expectRevert();
        vm.prank(withdrawer);
        t.reinstate(uid2);
        _timelocked(d.trwi, abi.encodeCall(TRWIV4.reinstate, (uid2)), "3");
        assertFalse(t.withdrawnUID(uid2));
    }

    function _cycleAdmin() internal {
        TRWIV4 t = TRWIV4(d.trwi);
        // guardian pause, unpause only through the timelock
        vm.prank(guardian);
        RegenPrimarySaleV3(d.primarySale).pause();
        vm.expectRevert();
        vm.prank(guardian);
        RegenPrimarySaleV3(d.primarySale).unpause();
        _timelocked(d.primarySale, abi.encodeCall(RegenPrimarySaleV3.unpause, ()), "4");
        assertFalse(RegenPrimarySaleV3(d.primarySale).paused());

        // token upgrade only through the timelock
        TRWIV4 next = new TRWIV4();
        vm.expectRevert();
        vm.prank(adminWallet);
        t.upgradeToAndCall(address(next), "");
        _timelocked(d.trwi, abi.encodeCall(t.upgradeToAndCall, (address(next), "")), "5");
        assertEq(t.balanceOf(buyer, 1), 6, "holdings survive the upgrade");
    }

    function _attest(bytes memory data, address recipient) internal returns (bytes32) {
        return IEAS(cfg.eas).attest(
            AttestationRequest({
                schema: d.schemaUID,
                data: AttestationRequestData({
                    recipient: recipient,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: data,
                    value: 0
                })
            })
        );
    }

    function _voucher(bytes32 uid, address creator, address partner, string memory uri)
        internal
        view
        returns (RegenPrimarySaleV3.Voucher memory)
    {
        return RegenPrimarySaleV3.Voucher({
            tokenId: 1,
            creator: creator,
            totalIV: 1000 ether,
            maxEditions: 100,
            pricePerEdition: 10e6,
            currency: d.testStablecoin,
            beneficiary: creator,
            recipient: address(0),
            easUID: uid,
            metadataURI: uri,
            royaltyBps: 250,
            feeBps: 250,
            partner: partner,
            partnerFeeBps: 500,
            resaleFeeBps: 250,
            resalePartnerBps: 250,
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
    }

    function _sign(RegenPrimarySaleV3.Voucher memory v) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(signerPk, RegenPrimarySaleV3(d.primarySale).hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    function _fund(TestUSDG usd, address to, uint256 amount) internal {
        while (amount > 0) {
            uint256 m = amount > usd.MAX_MINT() ? usd.MAX_MINT() : amount;
            usd.mint(to, m);
            amount -= m;
        }
    }
}

contract DeployRevision4Test is DeployRevision4Checks {
    SchemaRegistry internal registry;
    EAS internal eas;

    function setUp() public {
        registry = new SchemaRegistry();
        eas = new EAS(ISchemaRegistry(address(registry)));
    }

    function test_Deploy_HandsOverEveryRole() public {
        _deploy(_config(address(eas), address(registry)));
        _checkRoles();
        _checkDeployerCannotAct();
    }

    function test_Deploy_AdminOnlyThroughTimelockAfterDelay() public {
        _deploy(_config(address(eas), address(registry)));
        _checkTimelock();
    }

    function test_Deploy_FullCycle() public {
        _deploy(_config(address(eas), address(registry)));
        _cycle();
    }

    function test_Deploy_SchemaIsTheV2Format() public {
        _deploy(_config(address(eas), address(registry)));
        assertEq(registry.getSchema(d.schemaUID).schema, script.IMPACT_CLAIM_V2_SCHEMA());
        assertEq(address(registry.getSchema(d.schemaUID).resolver), d.resolver);
    }

    function test_ConfigFromEnv_ReadsAddressesOnly() public {
        script = new DeployRevision4();
        vm.setEnv("EAS_ADDRESS", vm.toString(address(eas)));
        vm.setEnv("SCHEMA_REGISTRY_ADDRESS", vm.toString(address(registry)));
        vm.setEnv("ADMIN_ADDRESS", vm.toString(adminWallet));
        vm.setEnv("TIMELOCK_DELAY", "300");
        vm.setEnv("SIGNER_ADDRESS", vm.toString(address(0x51)));
        vm.setEnv("ATTESTER_ADDRESS", vm.toString(attester));
        vm.setEnv("WITHDRAWER_ADDRESS", vm.toString(withdrawer));
        vm.setEnv("GUARDIAN_ADDRESS", vm.toString(guardian));
        vm.setEnv("FEE_RECIPIENT", vm.toString(feeRecipient));
        vm.setEnv("ALLOWED_CURRENCIES", string.concat(vm.toString(address(eas)), ",", vm.toString(address(registry))));
        vm.setEnv("DEPLOY_TEST_STABLECOIN", "false");
        DeployRevision4.Config memory c = script.configFromEnv();
        assertEq(c.eas, address(eas));
        assertEq(c.admin, adminWallet);
        assertEq(c.timelockDelay, 300);
        assertEq(c.signer, address(0x51));
        assertEq(c.currencies.length, 2);
        assertFalse(c.deployTestStablecoin);
        script.validate(c, deployer);
    }

    function test_Validate_RejectsDeployerAsRoleHolder() public {
        DeployRevision4.Config memory c = _config(address(eas), address(registry));
        c.guardian = deployer;
        script = new DeployRevision4();
        vm.expectRevert(abi.encodeWithSelector(DeployRevision4.BadConfig.selector, "role holder is the deployer"));
        script.deployAs(c, deployer);
    }

    function test_Validate_RejectsZeroHolderZeroDelayWrongRegistryNoCurrency() public {
        script = new DeployRevision4();
        DeployRevision4.Config memory c = _config(address(eas), address(registry));
        c.signer = address(0);
        vm.expectRevert(abi.encodeWithSelector(DeployRevision4.BadConfig.selector, "role holder is zero"));
        script.validate(c, deployer);

        c = _config(address(eas), address(registry));
        c.timelockDelay = 0;
        vm.expectRevert(abi.encodeWithSelector(DeployRevision4.BadConfig.selector, "TIMELOCK_DELAY is 0"));
        script.validate(c, deployer);

        SchemaRegistry other = new SchemaRegistry();
        c = _config(address(eas), address(other));
        vm.expectRevert(abi.encodeWithSelector(DeployRevision4.BadConfig.selector, "EAS uses another SchemaRegistry"));
        script.validate(c, deployer);

        c = _config(address(eas), address(registry));
        c.deployTestStablecoin = false;
        vm.expectRevert(abi.encodeWithSelector(DeployRevision4.BadConfig.selector, "no stablecoin"));
        script.validate(c, deployer);
    }
}

/// @dev Fork tests: the real deploy script against an in-process copy of each live test network (forge's own
///      fork, no local node). The existing EAS + SchemaRegistry of the network are reused, as in production.
///      Skipped unless FORK_ARBITRUM_SEPOLIA_RPC / FORK_ROBINHOOD_TESTNET_RPC / FORK_CELO_SEPOLIA_RPC are set.
contract DeployRevision4ForkTest is DeployRevision4Checks {
    function _fork(string memory envKey, address eas, address registry) internal {
        string memory rpc = vm.envOr(envKey, string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        _deploy(_config(eas, registry));
        _checkRoles();
        _checkDeployerCannotAct();
        _checkTimelock();
        _cycle();
    }

    // Addresses from deployments/*.json (the EAS + SchemaRegistry the network already uses).
    function test_Fork_ArbitrumSepolia() public {
        _fork(
            "FORK_ARBITRUM_SEPOLIA_RPC",
            0x95cD0E3bDbC670e057416D65C89B584a9a24d95d,
            0xa5dB5eC4d2F1435f7cb3504414981347E28340b4
        );
    }

    function test_Fork_RobinhoodTestnet() public {
        _fork(
            "FORK_ROBINHOOD_TESTNET_RPC",
            0x95cD0E3bDbC670e057416D65C89B584a9a24d95d,
            0xa5dB5eC4d2F1435f7cb3504414981347E28340b4
        );
    }

    function test_Fork_CeloSepolia() public {
        _fork(
            "FORK_CELO_SEPOLIA_RPC",
            0x82448c9c9b95Da5dCe9905F9C59CcCA0DF346df8,
            0x28747503194756DF51503902949c66D2F3579625
        );
    }
}

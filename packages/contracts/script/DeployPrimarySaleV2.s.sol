// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { TRWI } from "../src/TRWI.sol";
import { RegenPrimarySale } from "../src/RegenPrimarySale.sol";

/// @notice Deploy RegenPrimarySale v2 (partner share) next to an existing TRWI and wire it like v1:
///         SIGNER_ROLE + PAUSER_ROLE, currency allowlist, MINTER_ROLE on TRWI. The v1 sale keeps its
///         MINTER_ROLE until the web has switched and a test purchase passed (revoke separately).
///         Env: DEPLOYER_PRIVATE_KEY, TRWI_ADDRESS, optional SIGNER_ADDR / PAUSER_ADDR / FEE_RECIPIENT
///         (default: deployer) and ALLOWED_CURRENCIES (comma-separated ERC-20s; NATIVE is always allowed).
contract DeployPrimarySaleV2 is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address trwi = vm.envAddress("TRWI_ADDRESS");
        address signer = vm.envOr("SIGNER_ADDR", deployer);
        address pauser = vm.envOr("PAUSER_ADDR", deployer);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address[] memory currencies = vm.envOr("ALLOWED_CURRENCIES", ",", new address[](0));

        vm.startBroadcast(pk);
        RegenPrimarySale sale = new RegenPrimarySale(deployer, trwi, feeRecipient);
        sale.grantRole(sale.SIGNER_ROLE(), signer);
        sale.grantRole(sale.PAUSER_ROLE(), pauser);
        for (uint256 i = 0; i < currencies.length; i++) {
            sale.setCurrencyAllowed(currencies[i], true);
        }
        TRWI(trwi).grantRole(TRWI(trwi).MINTER_ROLE(), address(sale));
        vm.stopBroadcast();

        console2.log("RegenPrimarySale v2", address(sale));
        console2.log("signer", signer);
        console2.log("feeRecipient", feeRecipient);
        console2.log("currencies allowed", currencies.length);
    }
}

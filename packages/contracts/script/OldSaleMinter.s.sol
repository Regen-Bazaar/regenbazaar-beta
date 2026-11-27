// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { TRWI } from "../src/TRWI.sol";

/// @notice Switch step of revision 4 on the OLD contracts: remove (or, for rollback, give back) the old
///         primary sale's minting right on the old TRWI, so no impact is ever sellable on both generations.
/// @dev    Env: OLD_ADMIN_PRIVATE_KEY (admin of the old TRWI), OLD_TRWI_ADDRESS, OLD_PRIMARY_SALE_ADDRESS
///         (comma-separated: v1 and v2 sales), GRANT_BACK (default false; true = rollback).
contract OldSaleMinter is Script {
    function run() external {
        uint256 pk = vm.envUint("OLD_ADMIN_PRIVATE_KEY");
        TRWI trwi = TRWI(vm.envAddress("OLD_TRWI_ADDRESS"));
        address[] memory sales = vm.envAddress("OLD_PRIMARY_SALE_ADDRESS", ",");
        bool grantBack = vm.envOr("GRANT_BACK", false);
        bytes32 role = trwi.MINTER_ROLE();

        vm.startBroadcast(pk);
        for (uint256 i = 0; i < sales.length; ++i) {
            if (grantBack) trwi.grantRole(role, sales[i]);
            else trwi.revokeRole(role, sales[i]);
        }
        vm.stopBroadcast();

        for (uint256 i = 0; i < sales.length; ++i) {
            console2.log(sales[i], "MINTER_ROLE", trwi.hasRole(role, sales[i]));
        }
    }
}

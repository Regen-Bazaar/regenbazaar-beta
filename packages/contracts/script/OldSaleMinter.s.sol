// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script, console2 } from "forge-std/Script.sol";
import { TRWI } from "../src/TRWI.sol";

/// @notice Switch step of revision 4 on the OLD contracts: remove (or, for rollback, give back) the old primary
///         sale's minting right on the old TRWI, so no impact is ever sellable on both generations.
/// @dev    Env: OLD_ADMIN_PRIVATE_KEY (admin of the old TRWI), OLD_TRWI_ADDRESS, OLD_PRIMARY_SALE_ADDRESS
///         (comma-separated: v1 and v2 sales; revoke run only), GRANT_BACK (default false; true = rollback).
///         The revoke run writes rollback/old-minter-<chainId>.json with which sales held MINTER_ROLE before it
///         and refuses to overwrite an existing snapshot. The rollback reads that file and gives the role back
///         ONLY to those sales, so a sale that was already off stays off. Keep the file with the deployment.
contract OldSaleMinter is Script {
    error SnapshotExists(string path);
    error SnapshotMismatch();

    function snapshotPath(uint256 chainId) public view returns (string memory) {
        return string.concat(vm.projectRoot(), "/rollback/old-minter-", vm.toString(chainId), ".json");
    }

    function run() external {
        uint256 pk = vm.envUint("OLD_ADMIN_PRIVATE_KEY");
        TRWI trwi = TRWI(vm.envAddress("OLD_TRWI_ADDRESS"));
        if (vm.envOr("GRANT_BACK", false)) {
            grantBack(trwi, vm.addr(pk), pk);
        } else {
            revoke(trwi, vm.envAddress("OLD_PRIMARY_SALE_ADDRESS", ","), vm.addr(pk), pk);
        }
    }

    /// @dev Records who held the role, then revokes it from every listed sale. `pk` 0 = prank-style (tests).
    function revoke(TRWI trwi, address[] memory sales, address admin, uint256 pk) public {
        string memory path = snapshotPath(block.chainid);
        if (vm.exists(path)) revert SnapshotExists(path);
        vm.createDir(string.concat(vm.projectRoot(), "/rollback"), true);
        bytes32 role = trwi.MINTER_ROLE();
        bool[] memory held = new bool[](sales.length);
        for (uint256 i = 0; i < sales.length; ++i) {
            held[i] = trwi.hasRole(role, sales[i]);
            console2.log(sales[i], "held MINTER_ROLE before the switch:", held[i]);
        }
        string memory key = "snapshot";
        vm.serializeAddress(key, "trwi", address(trwi));
        vm.serializeAddress(key, "sales", sales);
        string memory json = vm.serializeBool(key, "heldBefore", held);
        vm.writeJson(json, path);

        _start(admin, pk);
        for (uint256 i = 0; i < sales.length; ++i) {
            if (held[i]) trwi.revokeRole(role, sales[i]);
        }
        vm.stopBroadcast();
    }

    /// @dev Gives the role back only to the sales that held it before the revoke run.
    function grantBack(TRWI trwi, address admin, uint256 pk) public {
        string memory json = vm.readFile(snapshotPath(block.chainid));
        if (vm.parseJsonAddress(json, ".trwi") != address(trwi)) revert SnapshotMismatch();
        address[] memory sales = vm.parseJsonAddressArray(json, ".sales");
        bool[] memory held = vm.parseJsonBoolArray(json, ".heldBefore");
        if (sales.length != held.length) revert SnapshotMismatch();
        bytes32 role = trwi.MINTER_ROLE();
        _start(admin, pk);
        for (uint256 i = 0; i < sales.length; ++i) {
            if (held[i]) trwi.grantRole(role, sales[i]);
        }
        vm.stopBroadcast();
        for (uint256 i = 0; i < sales.length; ++i) {
            console2.log(sales[i], "MINTER_ROLE now:", trwi.hasRole(role, sales[i]));
        }
    }

    function _start(address admin, uint256 pk) internal {
        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast(admin);
    }
}

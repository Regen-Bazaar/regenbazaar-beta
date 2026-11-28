// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { TRWI } from "../../src/TRWI.sol";
import { OldSaleMinter } from "../../script/OldSaleMinter.s.sol";

/// @dev The switch step on the old contracts and its rollback: only the sales that held MINTER_ROLE before the
///      switch get it back.
contract OldSaleMinterTest is Test {
    TRWI internal trwi;
    OldSaleMinter internal script;
    address internal admin = makeAddr("oldAdmin");
    address internal saleV1 = makeAddr("saleV1");
    address internal saleV2 = makeAddr("saleV2");

    function setUp() public {
        TRWI impl = new TRWI();
        trwi = TRWI(address(new ERC1967Proxy(address(impl), abi.encodeCall(TRWI.initialize, (admin, address(0xEA5), bytes32("s"))))));
        bytes32 role = trwi.MINTER_ROLE();
        vm.prank(admin);
        trwi.grantRole(role, saleV2); // v1 already lost the role earlier, v2 holds it
        script = new OldSaleMinter();
    }

    /// Each test uses its own chain id, so parallel tests never share a snapshot file.
    function _fresh(uint256 chainId) internal {
        vm.chainId(chainId);
        string memory path = script.snapshotPath(chainId);
        if (vm.exists(path)) vm.removeFile(path);
    }

    function _cleanup() internal {
        string memory path = script.snapshotPath(block.chainid);
        if (vm.exists(path)) vm.removeFile(path);
    }

    function _sales() internal view returns (address[] memory s) {
        s = new address[](2);
        s[0] = saleV1;
        s[1] = saleV2;
    }

    function test_RollbackRestoresOnlyTheSalesThatHeldTheRole() public {
        _fresh(777_101);
        script.revoke(trwi, _sales(), admin, 0);
        assertFalse(trwi.hasRole(trwi.MINTER_ROLE(), saleV1));
        assertFalse(trwi.hasRole(trwi.MINTER_ROLE(), saleV2));
        script.grantBack(trwi, admin, 0);
        assertFalse(trwi.hasRole(trwi.MINTER_ROLE(), saleV1), "v1 was off before the switch and stays off");
        assertTrue(trwi.hasRole(trwi.MINTER_ROLE(), saleV2));
        _cleanup();
    }

    function test_SecondRevokeRunCannotOverwriteTheSnapshot() public {
        _fresh(777_102);
        script.revoke(trwi, _sales(), admin, 0);
        vm.expectRevert();
        script.revoke(trwi, _sales(), admin, 0);
        _cleanup();
    }

    function test_RollbackRefusesASnapshotOfAnotherToken() public {
        _fresh(777_103);
        script.revoke(trwi, _sales(), admin, 0);
        TRWI other = TRWI(address(new ERC1967Proxy(address(new TRWI()), abi.encodeCall(TRWI.initialize, (admin, address(0xEA5), bytes32("s"))))));
        vm.expectRevert(OldSaleMinter.SnapshotMismatch.selector);
        script.grantBack(other, admin, 0);
        _cleanup();
    }
}

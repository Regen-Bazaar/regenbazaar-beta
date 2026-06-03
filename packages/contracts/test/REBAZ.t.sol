// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {REBAZ} from "../src/REBAZ.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract REBAZTest is Test {
    REBAZ internal token;
    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal staking = makeAddr("staking");
    address internal alice = makeAddr("alice");
    bytes32 internal MINTER;

    function setUp() public {
        token = new REBAZ(admin, treasury, 1_000_000 ether);
        MINTER = token.MINTER_ROLE();
        vm.prank(admin);
        token.grantRole(MINTER, staking);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Regen Bazaar");
        assertEq(token.symbol(), "REBAZ");
        assertEq(token.decimals(), 18);
    }

    function test_InitialSupplyToTreasury() public view {
        assertEq(token.balanceOf(treasury), 1_000_000 ether);
        assertEq(token.totalSupply(), 1_000_000 ether);
    }

    function test_MinterCanMint() public {
        vm.prank(staking);
        token.mint(alice, 500 ether);
        assertEq(token.balanceOf(alice), 500 ether);
    }

    function test_NonMinterCannotMint() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, token.MINTER_ROLE())
        );
        vm.prank(alice);
        token.mint(alice, 1 ether);
    }

    function test_Burn() public {
        vm.prank(treasury);
        token.burn(100 ether);
        assertEq(token.balanceOf(treasury), 1_000_000 ether - 100 ether);
    }

    function test_AdminCanGrantAndRevokeMinter() public {
        assertTrue(token.hasRole(MINTER, staking));
        vm.prank(admin);
        token.revokeRole(MINTER, staking);
        assertFalse(token.hasRole(MINTER, staking));
    }

    function testFuzz_MinterMint(uint96 amount) public {
        vm.prank(staking);
        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }
}

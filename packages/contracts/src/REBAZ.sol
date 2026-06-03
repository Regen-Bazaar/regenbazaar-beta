// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title  REBAZ — Regen Bazaar utility & rewards token
/// @notice ERC20 with gasless approvals (Permit) and role-gated minting for staking rewards.
/// @dev    PLACEHOLDER testnet tokenomics: rewards are minted on demand by MINTER_ROLE
///         (the staking contract). Supply is currently uncapped — real emission/cap policy
///         must be finalized before mainnet. The staking contract is designed to be swappable
///         to a funded-reserve model without changing this token.
contract REBAZ is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @param admin    receives DEFAULT_ADMIN_ROLE (manages roles); use a multisig on mainnet.
    /// @param treasury receives the initial supply (may be zero).
    /// @param initialSupply pre-minted amount to `treasury` (18 decimals).
    constructor(address admin, address treasury, uint256 initialSupply)
        ERC20("Regen Bazaar", "REBAZ")
        ERC20Permit("Regen Bazaar")
    {
        require(admin != address(0), "REBAZ: admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (initialSupply > 0) {
            require(treasury != address(0), "REBAZ: treasury=0");
            _mint(treasury, initialSupply);
        }
    }

    /// @notice Mint rewards. Restricted to MINTER_ROLE (granted to the staking contract).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Capped } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title  REBAZ — Regen Bazaar utility & rewards token
/// @notice ERC20 with gasless approvals (Permit), role-gated minting for staking rewards, and a hard
///         supply cap so emission can never exceed a fixed ceiling.
/// @dev    Rewards are minted on demand by MINTER_ROLE (the staking contract) up to `cap()`. The staking
///         contract is designed to be swappable to a funded-reserve model without changing this token;
///         until then the cap is the inflation backstop. Mint reverts once the cap is reached — callers
///         that must always succeed (e.g. principal exits) must not depend on minting (see TRWIStaking
///         emergencyUnstake). Set the cap to the final tokenomics ceiling at deploy.
contract REBAZ is ERC20, ERC20Burnable, ERC20Capped, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @param admin         receives DEFAULT_ADMIN_ROLE (manages roles); use a multisig on mainnet.
    /// @param treasury      receives the initial supply (may be zero).
    /// @param initialSupply pre-minted amount to `treasury` (18 decimals); must be <= cap_.
    /// @param cap_          hard maximum total supply (18 decimals); must be > 0.
    constructor(address admin, address treasury, uint256 initialSupply, uint256 cap_)
        ERC20("Regen Bazaar", "REBAZ")
        ERC20Capped(cap_)
        ERC20Permit("Regen Bazaar")
    {
        require(admin != address(0), "REBAZ: admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (initialSupply > 0) {
            require(treasury != address(0), "REBAZ: treasury=0");
            _mint(treasury, initialSupply); // reverts via ERC20Capped if initialSupply > cap_
        }
    }

    /// @notice Mint rewards. Restricted to MINTER_ROLE (granted to the staking contract). Reverts past cap.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @dev Single _update resolution across ERC20 and ERC20Capped (cap enforced on mint).
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
        super._update(from, to, value);
    }
}

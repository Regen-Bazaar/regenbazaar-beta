// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET-ONLY stand-in for Paxos USDG (same ERC-20 interface, 6 decimals) used while the Paxos
///         testnet faucet is not dispensing. NOT issued by Paxos, no value. Anyone can mint up to
///         MAX_MINT per call so demo buyers can fund a purchase. Never deploy to mainnet.
contract TestUSDG is ERC20 {
    uint256 public constant MAX_MINT = 1_000 * 1e6;

    error MintTooLarge();

    constructor() ERC20("Test USDG (testnet stand-in, not Paxos)", "tUSDG") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        if (amount > MAX_MINT) revert MintTooLarge();
        _mint(to, amount);
    }
}

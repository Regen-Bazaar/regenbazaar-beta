// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

/// @dev Minimal ERC1155 + ERC2981 stand-in for tRWI in marketplace unit tests.
contract MockImpactToken is ERC1155, ERC2981 {
    constructor() ERC1155("") { }

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount, "");
    }

    function setRoyalty(uint256 id, address receiver, uint96 bps) external {
        _setTokenRoyalty(id, receiver, bps);
    }

    function supportsInterface(bytes4 iid) public view override(ERC1155, ERC2981) returns (bool) {
        return super.supportsInterface(iid);
    }
}

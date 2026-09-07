// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Attestation } from "@ethereum-attestation-service/eas-contracts/Common.sol";

/// @dev Minimal EAS stand-in for unit tests: only `getAttestation` is exercised by TRWI.
contract MockEAS {
    mapping(bytes32 => Attestation) internal _att;

    function set(Attestation memory a) external {
        _att[a.uid] = a;
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return _att[uid];
    }
}

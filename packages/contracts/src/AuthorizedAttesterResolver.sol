// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/resolver/SchemaResolver.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import { Attestation } from "@ethereum-attestation-service/eas-contracts/Common.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title  AuthorizedAttesterResolver
/// @notice EAS schema resolver that only lets addresses holding ATTESTER_ROLE create ImpactClaim
///         attestations. This anchors tRWI minting trust in an authorized validator set — admin-managed
///         in beta, expandable to a decentralized validator set later (just grant/revoke the role).
contract AuthorizedAttesterResolver is SchemaResolver, AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    constructor(IEAS eas, address admin) SchemaResolver(eas) {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @dev Only authorized attesters may attest under this schema.
    function onAttest(
        Attestation calldata attestation,
        uint256 /*value*/
    )
        internal
        view
        override
        returns (bool)
    {
        return hasRole(ATTESTER_ROLE, attestation.attester);
    }

    /// @dev EAS already restricts revocation to the original attester; allow it.
    function onRevoke(Attestation calldata, uint256) internal pure override returns (bool) {
        return true;
    }
}

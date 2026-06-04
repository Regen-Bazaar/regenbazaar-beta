// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC1155Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {
    ERC1155SupplyUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import { ERC2981Upgradeable } from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {
    AccessControlUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { IEAS } from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import {
    Attestation,
    EMPTY_UID,
    NO_EXPIRATION_TIME
} from "@ethereum-attestation-service/eas-contracts/Common.sol";

/// @title  tRWI — tokenized real-world impact (ERC-1155, UUPS) — v2 lazy-mint token
/// @notice Platform-issued, lazily minted. Each `tokenId` is one impact "collection" of `maxEditions` (N)
///         fractional shares; `totalIV` (the impact value) is split across N, so each edition carries
///         totalIV/N. Editions are minted on demand (on purchase) by a `MINTER_ROLE` holder (the
///         RegenPrimarySale contract) — nothing is minted before a buyer exists. Holders can `retire`
///         editions to permanently claim their fraction.
/// @dev    A collection is registered on its first mint and is anchored to an immutable EAS ImpactClaim
///         attestation: the registration params (creator, totalIV, metadataURI) MUST equal the attestation's
///         (ngo, impactValue, metadataURI). This is the token's source of truth; the sale layer only adds
///         commercial terms. The on-chain minter (issuer) is the platform; `creator` records the NGO.
contract TRWI is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Hard cap on per-collection royalty (10%) — bounds ERC-2981's 100% ceiling so a collection
    ///         can never be registered with a royalty that would starve secondary-sale beneficiaries.
    uint96 public constant MAX_ROYALTY_BPS = 1000;

    struct Collection {
        address creator; // the NGO (must equal the attestation's `ngo`)
        uint256 totalIV; // total impact value across all editions (1e18-scaled)
        uint256 maxEditions; // N — fractionalization granularity, fixed at registration
        uint256 minted; // editions minted so far (lazy)
        bytes32 easUID; // backing EAS attestation
    }

    /// @dev Passed by the minter (RegenPrimarySale). First mint of a tokenId registers the collection;
    ///      later mints must pass matching params.
    struct MintParams {
        uint256 tokenId;
        address creator;
        uint256 totalIV;
        uint256 maxEditions;
        bytes32 easUID;
        string metadataURI;
        uint96 royaltyBps;
    }

    IEAS public eas;
    bytes32 public impactClaimSchema;
    mapping(uint256 => Collection) private _collections;
    mapping(uint256 => string) private _uris;
    mapping(bytes32 => uint256) public tokenIdForUID; // easUID => tokenId (0 = unused)

    event CollectionRegistered(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 totalIV,
        uint256 maxEditions,
        bytes32 indexed easUID,
        string uri
    );
    event ImpactMinted(uint256 indexed tokenId, address indexed to, uint256 amount, bytes32 indexed easUID);
    event ImpactRetired(uint256 indexed tokenId, address indexed holder, uint256 amount, uint256 ivRetired);

    error UID_Unknown();
    error UID_WrongSchema();
    error UID_Revoked();
    error UID_Expired();
    error UID_AlreadyUsed();
    error BadParams();
    error Mismatch();
    error ExceedsMax();
    error RoyaltyTooHigh();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address eas_, bytes32 impactClaimSchema_) public initializer {
        __ERC1155_init("");
        __ERC1155Supply_init();
        __ERC2981_init();
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        if (admin == address(0) || eas_ == address(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        eas = IEAS(eas_);
        impactClaimSchema = impactClaimSchema_;
    }

    /// @notice Mint `amount` editions of `p.tokenId` to `to` (lazy). Registers the collection on first mint.
    ///         Gated to MINTER_ROLE (the sale contract). Enforces the EAS anchor + the `maxEditions` cap.
    function mint(MintParams calldata p, address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (amount == 0 || to == address(0)) revert BadParams();
        Collection storage c = _collections[p.tokenId];
        if (c.maxEditions == 0) {
            _register(p);
        } else if (
            c.creator != p.creator || c.totalIV != p.totalIV || c.maxEditions != p.maxEditions
                || c.easUID != p.easUID
        ) {
            revert Mismatch();
        }
        if (c.minted + amount > c.maxEditions) revert ExceedsMax();
        unchecked {
            c.minted += amount; // bounded by maxEditions per the check above
        }
        _mint(to, p.tokenId, amount, "");
        emit ImpactMinted(p.tokenId, to, amount, c.easUID);
    }

    function _register(MintParams calldata p) internal {
        if (p.tokenId == 0 || p.creator == address(0) || p.totalIV == 0 || p.maxEditions == 0) {
            revert BadParams();
        }
        if (p.royaltyBps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        if (tokenIdForUID[p.easUID] != 0) revert UID_AlreadyUsed();

        Attestation memory att = eas.getAttestation(p.easUID);
        if (att.uid == EMPTY_UID) revert UID_Unknown();
        if (att.schema != impactClaimSchema) revert UID_WrongSchema();
        if (att.revocationTime != 0) revert UID_Revoked();
        if (att.expirationTime != NO_EXPIRATION_TIME && att.expirationTime <= block.timestamp) {
            revert UID_Expired();
        }

        // Anchor the collection to the immutable attestation — params must agree with the verified impact.
        (address ngo, uint256 iv, string memory metaURI) = abi.decode(att.data, (address, uint256, string));
        if (
            p.creator != ngo || p.totalIV != iv
                || keccak256(bytes(p.metadataURI)) != keccak256(bytes(metaURI))
        ) {
            revert Mismatch();
        }

        _collections[p.tokenId] = Collection(p.creator, p.totalIV, p.maxEditions, 0, p.easUID);
        _uris[p.tokenId] = p.metadataURI;
        tokenIdForUID[p.easUID] = p.tokenId;
        if (p.royaltyBps > 0) _setTokenRoyalty(p.tokenId, p.creator, p.royaltyBps);

        emit CollectionRegistered(p.tokenId, p.creator, p.totalIV, p.maxEditions, p.easUID, p.metadataURI);
        emit URI(p.metadataURI, p.tokenId);
    }

    /// @notice Permanently retire (burn) `amount` editions of `tokenId` to claim that fractional impact.
    function retire(uint256 tokenId, uint256 amount) external {
        if (amount == 0) revert BadParams();
        _burn(msg.sender, tokenId, amount); // reverts on insufficient balance
        emit ImpactRetired(tokenId, msg.sender, amount, impactValueOf(tokenId, amount));
    }

    // ---- views ----

    function collection(uint256 tokenId) external view returns (Collection memory) {
        return _collections[tokenId];
    }

    /// @notice Fractional impact value carried by `amount` editions (denominator = maxEditions N).
    function impactValueOf(uint256 tokenId, uint256 amount) public view returns (uint256) {
        Collection memory c = _collections[tokenId];
        if (c.maxEditions == 0) return 0;
        return (c.totalIV * amount) / c.maxEditions;
    }

    /// @notice Editions permanently retired = minted minus the current circulating supply.
    function retiredEditions(uint256 tokenId) external view returns (uint256) {
        return _collections[tokenId].minted - totalSupply(tokenId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory u = _uris[tokenId];
        return bytes(u).length != 0 ? u : super.uri(tokenId);
    }

    // NOTE: metadata URI is immutable post-registration — it is anchored to the EAS attestation at
    // _register and cannot be mutated afterwards (a metadata change requires a new attestation + tokenId).

    /// @notice Halt new minting (existing holders can still transfer/retire). Guardian/PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---- required overrides ----

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Upgradeable, ERC1155SupplyUpgradeable)
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 iid)
        public
        view
        override(ERC1155Upgradeable, ERC2981Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(iid);
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) { }

    uint256[50] private __gap;
}

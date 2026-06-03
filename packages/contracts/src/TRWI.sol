// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {ERC1155SupplyUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IEAS} from "@ethereum-attestation-service/eas-contracts/IEAS.sol";
import {Attestation, EMPTY_UID, NO_EXPIRATION_TIME} from "@ethereum-attestation-service/eas-contracts/Common.sol";

/// @title  tRWI — tokenized real-world impact (ERC-1155, UUPS upgradeable)
/// @notice Each token id is one impact claim. `editions` are FRACTIONAL shares of that claim's total
///         impact value (sum over all editions == totalIV — no double counting), so the same impact is
///         never claimed twice. Holders can `retire` editions to permanently claim their fraction (offset).
/// @dev    Minting is gated by a valid, non-revoked EAS attestation of the configured ImpactClaim schema
///         (trust = attestation, not a trusted backend key). UUPS keeps a stable canonical address as the
///         impact registry evolves. Metadata is Hypercerts-compatible and carries rich agent-readable data.
contract TRWI is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    ERC2981Upgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant TOKENIZER_ROLE = keccak256("TOKENIZER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct ImpactRecord {
        address creator; // the NGO/community that created the impact
        uint256 totalIV; // total impact value of the claim (across all editions)
        uint256 editions; // editions minted = fractional shares
        bytes32 easUID; // backing EAS attestation
    }

    IEAS public eas;
    bytes32 public impactClaimSchema;
    uint256 public lastId;

    mapping(uint256 => ImpactRecord) private _records;
    mapping(uint256 => string) private _uris;
    mapping(bytes32 => uint256) public tokenIdForUID; // easUID => tokenId (0 = unused)

    event ImpactTokenized(
        uint256 indexed id, address indexed creator, uint256 totalIV, uint256 editions, bytes32 indexed easUID, string uri
    );
    event ImpactRetired(uint256 indexed id, address indexed holder, uint256 amount, uint256 ivRetired);

    error UID_Unknown();
    error UID_WrongSchema();
    error UID_Revoked();
    error UID_Expired();
    error UID_AlreadyUsed();
    error BadParams();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address eas_, bytes32 impactClaimSchema_) public initializer {
        __ERC1155_init("");
        __ERC1155Supply_init();
        __ERC2981_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        if (admin == address(0) || eas_ == address(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        eas = IEAS(eas_);
        impactClaimSchema = impactClaimSchema_;
    }

    /// @notice Mint `editions` fractional shares of a verified impact claim to its NGO creator.
    /// @dev    Caller must hold TOKENIZER_ROLE AND reference a valid ImpactClaim attestation. The NGO
    ///         recipient and impact value are taken from the attestation, not from the caller.
    function mintImpact(bytes32 easUID, uint256 editions, address royaltyReceiver, uint96 royaltyBps)
        external
        onlyRole(TOKENIZER_ROLE)
        returns (uint256 id)
    {
        if (editions == 0) revert BadParams();
        if (tokenIdForUID[easUID] != 0) revert UID_AlreadyUsed();

        Attestation memory att = eas.getAttestation(easUID);
        if (att.uid == EMPTY_UID) revert UID_Unknown();
        if (att.schema != impactClaimSchema) revert UID_WrongSchema();
        if (att.revocationTime != 0) revert UID_Revoked();
        if (att.expirationTime != NO_EXPIRATION_TIME && att.expirationTime <= block.timestamp) revert UID_Expired();

        (address ngo, uint256 iv, string memory metaURI) = abi.decode(att.data, (address, uint256, string));
        if (ngo == address(0) || iv == 0) revert BadParams();

        id = ++lastId;
        _records[id] = ImpactRecord({creator: ngo, totalIV: iv, editions: editions, easUID: easUID});
        _uris[id] = metaURI;
        tokenIdForUID[easUID] = id;
        if (royaltyReceiver != address(0)) _setTokenRoyalty(id, royaltyReceiver, royaltyBps);

        _mint(ngo, id, editions, "");
        emit URI(metaURI, id); // ERC1155 metadata signal for indexers/marketplaces
        emit ImpactTokenized(id, ngo, iv, editions, easUID, metaURI);
    }

    /// @notice Permanently retire (burn) `amount` editions of `id` to claim that fractional impact.
    function retire(uint256 id, uint256 amount) external {
        if (amount == 0) revert BadParams();
        _burn(msg.sender, id, amount); // reverts on insufficient balance
        emit ImpactRetired(id, msg.sender, amount, impactValueOf(id, amount));
    }

    // ---- views ----

    function record(uint256 id) external view returns (ImpactRecord memory) {
        return _records[id];
    }

    /// @notice Fractional impact value carried by `amount` editions of `id`.
    function impactValueOf(uint256 id, uint256 amount) public view returns (uint256) {
        ImpactRecord memory r = _records[id];
        if (r.editions == 0) return 0;
        return (r.totalIV * amount) / r.editions;
    }

    /// @notice Editions permanently retired (only `retire` burns).
    function retiredEditions(uint256 id) external view returns (uint256) {
        return _records[id].editions - totalSupply(id);
    }

    function uri(uint256 id) public view override returns (string memory) {
        string memory u = _uris[id];
        return bytes(u).length != 0 ? u : super.uri(id);
    }

    /// @notice Update a token's metadata URI. NOTE: metadata is admin-mutable post-mint — holders/buyers
    ///         should verify the impact data at acquisition time, not trust lazy lookups. Emits ERC1155 URI.
    function setURI(uint256 id, string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _uris[id] = newURI;
        emit URI(newURI, id);
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

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}

    /// @dev Reserve storage for future upgrades (defensive; OZ v5 bases use namespaced storage).
    uint256[50] private __gap;
}

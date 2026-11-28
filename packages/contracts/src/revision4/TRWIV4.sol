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

/// @title  tRWI, revision 4: tokenized real-world impact (ERC-1155, UUPS behind the timelock)
/// @notice Each `tokenId` is one impact of `maxEditions` editions, lazily minted by the sale contract and
///         anchored to an EAS ImpactClaim v2 attestation:
///         `address creator,uint256 impactValue,string metadataURI,uint8 proofLevel,string methodologyVersion,
///          address validator,address partner,bool transferable`.
///         The facts of the attestation are copied at the first mint. The partner and the resale shares are
///         fixed at that moment and can never change.
///         A false claim is withdrawn by WITHDRAWER_ROLE: no more mints, no resale through our marketplace,
///         no retire. Editions already sold stay where they are. Only the admin (timelock) reinstates.
///         Retire burns editions and writes a numbered contribution statement.
/// @dev    Roles: DEFAULT_ADMIN_ROLE and UPGRADER_ROLE = timelock; MINTER_ROLE = RegenPrimarySaleV3;
///         GUARDIAN_ROLE pauses only; unpause is an admin action.
contract TRWIV4 is
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
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    /// @notice Caps on the shares fixed per impact. Creator royalty (ERC-2981 and our resale) <= 10%;
    ///         platform resale fee <= 10%; partner resale share <= 10%; all three together <= 15%.
    uint96 public constant MAX_ROYALTY_BPS = 1000;
    uint96 public constant MAX_RESALE_FEE_BPS = 1000;
    uint96 public constant MAX_RESALE_PARTNER_BPS = 1000;
    uint96 public constant MAX_RESALE_TOTAL_BPS = 1500;
    uint8 public constant MAX_PROOF_LEVEL = 4; // P1..P4; 0 = not graded (methodology v0.1)
    uint256 public constant MAX_IN_NAME_OF_BYTES = 64;
    uint256 public constant MAX_REASON_BYTES = 256;

    struct Collection {
        address creator; // == attestation.creator
        uint256 totalIV; // == attestation.impactValue (1e18-scaled)
        uint256 maxEditions;
        uint256 minted;
        bytes32 easUID;
        address partner; // == attestation.partner; address(0) = none
        address validator; // == attestation.validator (the validator's sign-in wallet); address(0) = not recorded
        uint8 proofLevel; // == attestation.proofLevel
        bool transferable; // == attestation.transferable
        uint96 royaltyBps; // creator share on resale (also reported through ERC-2981)
        uint96 resaleFeeBps; // Regen Bazaar share on resale
        uint96 resalePartnerBps; // partner share on resale (0 when no partner)
        string methodologyVersion; // == attestation.methodologyVersion
    }

    /// @dev Passed by the minter. The first mint registers the impact; later mints must match it.
    struct MintParams {
        uint256 tokenId;
        address creator;
        uint256 totalIV;
        uint256 maxEditions;
        bytes32 easUID;
        string metadataURI;
        address partner;
        uint96 royaltyBps;
        uint96 resaleFeeBps;
        uint96 resalePartnerBps;
    }

    /// @notice What our marketplace needs for one resale. `tradable` = registered, transferable, not
    ///         withdrawn, attestation not revoked.
    struct MarketTerms {
        bool tradable;
        address creator;
        uint96 royaltyBps;
        uint96 resaleFeeBps;
        address partner;
        uint96 resalePartnerBps;
    }

    struct Statement {
        address holder;
        uint256 tokenId;
        uint256 amount;
        uint256 impactValue;
        uint64 timestamp;
        string inNameOf;
    }

    struct Claim {
        address creator;
        uint256 impactValue;
        string metadataURI;
        uint8 proofLevel;
        string methodologyVersion;
        address validator;
        address partner;
        bool transferable;
    }

    IEAS public eas;
    bytes32 public impactClaimSchema;
    mapping(uint256 => Collection) private _collections;
    mapping(uint256 => string) private _uris;
    mapping(bytes32 => uint256) public tokenIdForUID;
    /// @notice Withdrawn mark, by attestation UID (an impact can be withdrawn before its first sale).
    mapping(bytes32 => bool) public withdrawnUID;
    /// @notice Editions retired per impact per holder.
    mapping(uint256 => mapping(address => uint256)) public retiredBy;
    uint256 public statementCount;
    mapping(uint256 => Statement) private _statements;

    event CollectionRegistered(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 indexed easUID,
        uint256 totalIV,
        uint256 maxEditions,
        string uri
    );
    event CollectionTerms(
        uint256 indexed tokenId,
        address indexed partner,
        address indexed validator,
        uint8 proofLevel,
        string methodologyVersion,
        bool transferable,
        uint96 royaltyBps,
        uint96 resaleFeeBps,
        uint96 resalePartnerBps
    );
    event ImpactMinted(uint256 indexed tokenId, address indexed to, uint256 amount, bytes32 indexed easUID);
    event ContributionStatement(
        uint256 indexed statementId,
        uint256 indexed tokenId,
        address indexed holder,
        uint256 amount,
        uint256 impactValue,
        string inNameOf
    );
    event ImpactWithdrawn(bytes32 indexed easUID, uint256 indexed tokenId, address indexed by, string reasonURI);
    event ImpactReinstated(bytes32 indexed easUID, uint256 indexed tokenId, address indexed by);

    error UID_Unknown();
    error UID_WrongSchema();
    error UID_Revoked();
    error UID_Expired();
    error UID_AlreadyUsed();
    error BadParams();
    error Mismatch();
    error ExceedsMax();
    error RoyaltyTooHigh();
    error SharesTooHigh();
    error ImpactIsWithdrawn();
    error NotWithdrawn();
    error AlreadyWithdrawn();
    error NonTransferable();
    error TextTooLong();
    error UnknownToken();

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
        if (admin == address(0) || eas_ == address(0) || impactClaimSchema_ == bytes32(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        eas = IEAS(eas_);
        impactClaimSchema = impactClaimSchema_;
    }

    // ---- mint (sale contract only) ----

    /// @notice Mint `amount` editions to `to`. Registers the impact on its first mint. Refuses a withdrawn
    ///         impact and a revoked or expired attestation on every mint, not only the first.
    function mint(MintParams calldata p, address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (amount == 0 || to == address(0)) revert BadParams();
        if (withdrawnUID[p.easUID]) revert ImpactIsWithdrawn();
        Collection storage c = _collections[p.tokenId];
        if (c.maxEditions == 0) {
            _register(p);
        } else {
            if (
                c.creator != p.creator || c.totalIV != p.totalIV || c.maxEditions != p.maxEditions
                    || c.easUID != p.easUID || c.partner != p.partner
            ) {
                revert Mismatch();
            }
            _requireLive(_attestation(p.easUID));
        }
        if (c.minted + amount > c.maxEditions) revert ExceedsMax();
        unchecked {
            c.minted += amount; // bounded by maxEditions
        }
        _mint(to, p.tokenId, amount, "");
        emit ImpactMinted(p.tokenId, to, amount, p.easUID);
    }

    function _register(MintParams calldata p) internal {
        if (p.tokenId == 0 || p.creator == address(0) || p.totalIV == 0 || p.maxEditions == 0) {
            revert BadParams();
        }
        if (p.royaltyBps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh();
        if (p.resaleFeeBps > MAX_RESALE_FEE_BPS || p.resalePartnerBps > MAX_RESALE_PARTNER_BPS) {
            revert SharesTooHigh();
        }
        if (uint256(p.royaltyBps) + p.resaleFeeBps + p.resalePartnerBps > MAX_RESALE_TOTAL_BPS) {
            revert SharesTooHigh();
        }
        if (p.partner == address(0) && p.resalePartnerBps != 0) revert BadParams();
        if (tokenIdForUID[p.easUID] != 0) revert UID_AlreadyUsed();

        Attestation memory att = _attestation(p.easUID);
        _requireLive(att);
        Claim memory cl = decodeClaim(att.data);
        if (
            p.creator != cl.creator || p.totalIV != cl.impactValue || p.partner != cl.partner
                || keccak256(bytes(p.metadataURI)) != keccak256(bytes(cl.metadataURI))
        ) {
            revert Mismatch();
        }
        if (cl.proofLevel > MAX_PROOF_LEVEL) revert BadParams();

        Collection storage c = _collections[p.tokenId];
        c.creator = p.creator;
        c.totalIV = p.totalIV;
        c.maxEditions = p.maxEditions;
        c.easUID = p.easUID;
        c.partner = cl.partner;
        c.validator = cl.validator;
        c.proofLevel = cl.proofLevel;
        c.transferable = cl.transferable;
        c.royaltyBps = p.royaltyBps;
        c.resaleFeeBps = p.resaleFeeBps;
        c.resalePartnerBps = p.resalePartnerBps;
        c.methodologyVersion = cl.methodologyVersion;
        _uris[p.tokenId] = p.metadataURI;
        tokenIdForUID[p.easUID] = p.tokenId;
        if (p.royaltyBps > 0) _setTokenRoyalty(p.tokenId, p.creator, p.royaltyBps);

        emit CollectionRegistered(p.tokenId, p.creator, p.easUID, p.totalIV, p.maxEditions, p.metadataURI);
        emit CollectionTerms(
            p.tokenId,
            cl.partner,
            cl.validator,
            cl.proofLevel,
            cl.methodologyVersion,
            cl.transferable,
            p.royaltyBps,
            p.resaleFeeBps,
            p.resalePartnerBps
        );
        emit URI(p.metadataURI, p.tokenId);
    }

    /// @notice Decode an ImpactClaim v2 attestation payload (the flat ABI encoding EAS uses).
    /// @dev EAS stores the flat encoding of the fields; prefixing the tuple offset (0x20) turns it into the
    ///      encoding of one `Claim` struct, which abi.decode reads with full validation.
    function decodeClaim(bytes memory data) public pure returns (Claim memory cl) {
        cl = abi.decode(bytes.concat(bytes32(uint256(0x20)), data), (Claim));
    }

    function _attestation(bytes32 uid) internal view returns (Attestation memory att) {
        att = eas.getAttestation(uid);
        if (att.uid == EMPTY_UID) revert UID_Unknown();
        if (att.schema != impactClaimSchema) revert UID_WrongSchema();
    }

    function _requireLive(Attestation memory att) internal view {
        if (att.revocationTime != 0) revert UID_Revoked();
        if (att.expirationTime != NO_EXPIRATION_TIME && att.expirationTime <= block.timestamp) {
            revert UID_Expired();
        }
    }

    // ---- retire with contribution statement ----

    /// @notice Burn `amount` editions and write contribution statement number `statementId`.
    ///         `inNameOf` is optional, public and permanent (max 64 bytes). Works while paused.
    function retire(uint256 tokenId, uint256 amount, string calldata inNameOf)
        external
        returns (uint256 statementId)
    {
        if (amount == 0) revert BadParams();
        if (bytes(inNameOf).length > MAX_IN_NAME_OF_BYTES) revert TextTooLong();
        Collection storage c = _collections[tokenId];
        if (c.maxEditions == 0) revert UnknownToken();
        if (withdrawnUID[c.easUID]) revert ImpactIsWithdrawn();
        _requireLive(_attestation(c.easUID));

        uint256 iv = impactValueOf(tokenId, amount);
        statementId = ++statementCount;
        retiredBy[tokenId][msg.sender] += amount;
        _statements[statementId] = Statement({
            holder: msg.sender,
            tokenId: tokenId,
            amount: amount,
            impactValue: iv,
            timestamp: uint64(block.timestamp),
            inNameOf: inNameOf
        });
        _burn(msg.sender, tokenId, amount); // reverts on insufficient balance
        emit ContributionStatement(statementId, tokenId, msg.sender, amount, iv, inNameOf);
    }

    // ---- withdraw a false claim ----

    /// @notice Mark an impact as withdrawn (false claim). Works before the first sale too.
    function withdraw(bytes32 easUID, string calldata reasonURI) external onlyRole(WITHDRAWER_ROLE) {
        if (easUID == bytes32(0) || bytes(reasonURI).length == 0) revert BadParams();
        if (bytes(reasonURI).length > MAX_REASON_BYTES) revert TextTooLong();
        if (withdrawnUID[easUID]) revert AlreadyWithdrawn();
        withdrawnUID[easUID] = true;
        emit ImpactWithdrawn(easUID, tokenIdForUID[easUID], msg.sender, reasonURI);
    }

    /// @notice Undo a withdrawal that was NOT followed by an EAS revocation (e.g. a stolen withdrawer key marked
    ///         good impact). Admin (timelock) only. An approved withdrawal also revokes the attestation, which EAS
    ///         cannot undo, so such an impact can never be reinstated: this call reverts with UID_Revoked.
    function reinstate(bytes32 easUID) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!withdrawnUID[easUID]) revert NotWithdrawn();
        if (eas.getAttestation(easUID).revocationTime != 0) revert UID_Revoked();
        withdrawnUID[easUID] = false;
        emit ImpactReinstated(easUID, tokenIdForUID[easUID], msg.sender);
    }

    // ---- views ----

    function collection(uint256 tokenId) external view returns (Collection memory) {
        return _collections[tokenId];
    }

    function statement(uint256 statementId) external view returns (Statement memory) {
        return _statements[statementId];
    }

    function isWithdrawn(uint256 tokenId) public view returns (bool) {
        bytes32 uid = _collections[tokenId].easUID;
        return uid != bytes32(0) && withdrawnUID[uid];
    }

    function marketTerms(uint256 tokenId) external view returns (MarketTerms memory t) {
        Collection storage c = _collections[tokenId];
        if (c.maxEditions == 0) return t;
        Attestation memory att = eas.getAttestation(c.easUID);
        bool live = att.revocationTime == 0
            && (att.expirationTime == NO_EXPIRATION_TIME || att.expirationTime > block.timestamp);
        t = MarketTerms({
            tradable: live && c.transferable && !withdrawnUID[c.easUID],
            creator: c.creator,
            royaltyBps: c.royaltyBps,
            resaleFeeBps: c.resaleFeeBps,
            partner: c.partner,
            resalePartnerBps: c.resalePartnerBps
        });
    }

    function impactValueOf(uint256 tokenId, uint256 amount) public view returns (uint256) {
        Collection storage c = _collections[tokenId];
        if (c.maxEditions == 0) return 0;
        return (c.totalIV * amount) / c.maxEditions;
    }

    function retiredEditions(uint256 tokenId) external view returns (uint256) {
        return _collections[tokenId].minted - totalSupply(tokenId);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory u = _uris[tokenId];
        return bytes(u).length != 0 ? u : super.uri(tokenId);
    }

    // ---- pause: guardian pauses, only the admin unpauses ----

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ---- overrides ----

    /// @dev Non-transferable impact: mint and burn only, no wallet-to-wallet moves.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Upgradeable, ERC1155SupplyUpgradeable)
    {
        if (from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; ++i) {
                if (!_collections[ids[i]].transferable) revert NonTransferable();
            }
        }
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

    uint256[45] private __gap;
}

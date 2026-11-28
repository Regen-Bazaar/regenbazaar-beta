// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { TRWIV4 } from "./TRWIV4.sol";

/// @title  RegenPrimarySale version 3: first sale of tRWI (revision 4) through signed EIP-712 vouchers
/// @notice The voucher signer (SIGNER_ROLE) signs a voucher with the impact and its commercial terms. The
///         payer redeems it: in one transaction Regen Bazaar gets `feeBps`, the partner `partnerFeeBps`, the
///         creator's `beneficiary` the rest, and `amount` editions are minted to `recipient` (or to the payer
///         when `recipient` is zero). Payment goes straight from the payer to each payee: the contract never
///         holds money. Stablecoins on the admin allowlist only; the network's own coin is not accepted.
/// @dev    Split rules and caps are those of version 2. New in version 3: `recipient`, the resale shares
///         fixed per impact at first sale (`resaleFeeBps`, `resalePartnerBps`), and the partner must equal
///         the attested partner (checked by TRWIV4). EIP-712 domain ("RegenPrimarySale", "3").
///         `mintCap` (owner decision 28.11.2026) bounds the editions that may exist after the purchase; the
///         site signs 25 while the edition limit holds and 100 after it lifts.
///         Roles: DEFAULT_ADMIN_ROLE = timelock; SIGNER_ROLE = voucher signer key; GUARDIAN_ROLE pauses only.
contract RegenPrimarySaleV3 is AccessControl, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    uint96 public constant MAX_FEE_BPS = 1000; // 10%, platform
    uint96 public constant MAX_PARTNER_FEE_BPS = 1000; // 10%, partner
    uint96 public constant MAX_TOTAL_FEE_BPS = 1500; // 15%, platform + partner
    uint96 internal constant BPS = 10_000;

    bytes32 public constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(uint256 tokenId,address creator,uint256 totalIV,uint256 maxEditions,uint256 pricePerEdition,address currency,address beneficiary,address recipient,bytes32 easUID,string metadataURI,uint96 royaltyBps,uint96 feeBps,address partner,uint96 partnerFeeBps,uint96 resaleFeeBps,uint96 resalePartnerBps,uint256 mintCap,uint256 nonce,uint256 deadline)"
    );

    TRWIV4 public immutable trwi;
    address public feeRecipient;
    mapping(address => bool) public allowedCurrency;
    /// @notice A voucher is valid only while `voucher.nonce == currentNonce[tokenId]`.
    mapping(uint256 => uint256) public currentNonce;

    struct Voucher {
        uint256 tokenId;
        address creator; // == attestation.creator (checked by TRWIV4)
        uint256 totalIV;
        uint256 maxEditions;
        uint256 pricePerEdition;
        address currency; // allowlisted stablecoin
        address beneficiary; // creator payout wallet
        address recipient; // wallet that receives the editions; address(0) = the payer
        bytes32 easUID;
        string metadataURI;
        uint96 royaltyBps; // creator share on resale, fixed at first sale
        uint96 feeBps; // platform fee of this sale
        address partner; // == attestation.partner; address(0) = none
        uint96 partnerFeeBps; // partner share of this sale (0 when no partner)
        uint96 resaleFeeBps; // platform share on resale, fixed at first sale
        uint96 resalePartnerBps; // partner share on resale, fixed at first sale
        uint256 mintCap; // editions of this impact that may exist after this purchase (site edition limit)
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice Who was paid how much in one sale.
    struct Payout {
        uint256 total;
        uint256 creatorPaid;
        uint256 platformPaid;
        uint256 partnerPaid;
        address beneficiary;
        address partner;
    }

    /// @notice One record per sale with every payout.
    event Sold(
        uint256 indexed tokenId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        address currency,
        Payout payout
    );
    event NonceBumped(uint256 indexed tokenId, uint256 newNonce);
    event FeeRecipientUpdated(address feeRecipient);
    event CurrencyAllowed(address indexed currency, bool allowed);

    error BadParams();
    error Expired();
    error StaleVoucher();
    error BadSignature();
    error BadCurrency();
    error ExceedsMintCap();

    constructor(address admin, address trwi_, address feeRecipient_) EIP712("RegenPrimarySale", "3") {
        if (admin == address(0) || trwi_ == address(0) || feeRecipient_ == address(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        trwi = TRWIV4(trwi_);
        feeRecipient = feeRecipient_;
    }

    function redeem(Voucher calldata v, uint256 amount, bytes calldata sig) external nonReentrant whenNotPaused {
        // ---- checks ----
        if (amount == 0 || v.beneficiary == address(0) || v.pricePerEdition == 0) revert BadParams();
        if (v.feeBps > MAX_FEE_BPS || v.partnerFeeBps > MAX_PARTNER_FEE_BPS) revert BadParams();
        if (uint256(v.feeBps) + v.partnerFeeBps > MAX_TOTAL_FEE_BPS) revert BadParams();
        if (v.partner == address(0) && v.partnerFeeBps != 0) revert BadParams();
        if (block.timestamp > v.deadline) revert Expired();
        if (v.nonce != currentNonce[v.tokenId]) revert StaleVoucher();
        if (!allowedCurrency[v.currency]) revert BadCurrency();
        address signer = ECDSA.recover(_hashTypedDataV4(_voucherStructHash(v)), sig);
        if (!hasRole(SIGNER_ROLE, signer)) revert BadSignature();

        // Edition limit: checked against the editions already minted on-chain, so a voucher reused within
        // its hour, or one signed before others were sold, can never push the total above its cap.
        if (trwi.collection(v.tokenId).minted + amount > v.mintCap) revert ExceedsMintCap();

        address to = v.recipient == address(0) ? msg.sender : v.recipient;
        Payout memory p = _payout(v, amount);

        // ---- interactions: payer -> payees directly, then mint (nonReentrant guards the mint callback) ----
        IERC20 token = IERC20(v.currency);
        if (p.platformPaid != 0) token.safeTransferFrom(msg.sender, feeRecipient, p.platformPaid);
        if (p.partnerPaid != 0) token.safeTransferFrom(msg.sender, v.partner, p.partnerPaid);
        if (p.creatorPaid != 0) token.safeTransferFrom(msg.sender, v.beneficiary, p.creatorPaid);

        trwi.mint(
            TRWIV4.MintParams({
                tokenId: v.tokenId,
                creator: v.creator,
                totalIV: v.totalIV,
                maxEditions: v.maxEditions,
                easUID: v.easUID,
                metadataURI: v.metadataURI,
                partner: v.partner,
                royaltyBps: v.royaltyBps,
                resaleFeeBps: v.resaleFeeBps,
                resalePartnerBps: v.resalePartnerBps
            }),
            to,
            amount
        );

        emit Sold(v.tokenId, msg.sender, to, amount, v.currency, p);
    }

    /// @dev Both shares round down; the remainder goes to the creator, so the payouts always sum to `total`.
    function _payout(Voucher calldata v, uint256 amount) internal pure returns (Payout memory p) {
        p.total = amount * v.pricePerEdition;
        p.platformPaid = (p.total * v.feeBps) / BPS;
        p.partnerPaid = (p.total * v.partnerFeeBps) / BPS;
        p.creatorPaid = p.total - p.platformPaid - p.partnerPaid;
        p.beneficiary = v.beneficiary;
        p.partner = v.partner;
    }

    /// @notice Invalidate every outstanding voucher of one impact (reprice or delist).
    function bumpNonce(uint256 tokenId) external onlyRole(SIGNER_ROLE) {
        uint256 n = ++currentNonce[tokenId];
        emit NonceBumped(tokenId, n);
    }

    function setFeeRecipient(address feeRecipient_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeRecipient_ == address(0)) revert BadParams();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    /// @notice Allowlist a stablecoin. Fee-on-transfer or rebasing tokens must never be allowed.
    function setCurrencyAllowed(address currency, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (currency == address(0)) revert BadCurrency();
        allowedCurrency[currency] = allowed;
        emit CurrencyAllowed(currency, allowed);
    }

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice EIP-712 digest of a voucher (the site's signer computes the same).
    function hashVoucher(Voucher calldata v) external view returns (bytes32) {
        return _hashTypedDataV4(_voucherStructHash(v));
    }

    function _voucherStructHash(Voucher calldata v) internal pure returns (bytes32) {
        // Every field encodes to one 32-byte word, so the concatenated chunks equal one abi.encode;
        // split only to avoid stack-too-deep.
        return keccak256(
            bytes.concat(
                abi.encode(
                    VOUCHER_TYPEHASH, v.tokenId, v.creator, v.totalIV, v.maxEditions, v.pricePerEdition
                ),
                abi.encode(v.currency, v.beneficiary, v.recipient, v.easUID, keccak256(bytes(v.metadataURI))),
                abi.encode(v.royaltyBps, v.feeBps, v.partner, v.partnerFeeBps, v.resaleFeeBps),
                abi.encode(v.resalePartnerBps, v.mintCap, v.nonce, v.deadline)
            )
        );
    }
}

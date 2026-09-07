// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev Minimal interface to TRWI v2's gated mint (registers-on-first-mint, EAS-anchored, cap-enforced).
interface ITRWI {
    struct MintParams {
        uint256 tokenId;
        address creator;
        uint256 totalIV;
        uint256 maxEditions;
        bytes32 easUID;
        string metadataURI;
        uint96 royaltyBps;
    }

    function mint(MintParams calldata p, address to, uint256 amount) external;
}

/// @title  RegenPrimarySale — platform-issued lazy mint via signed EIP-712 vouchers
/// @notice The platform (SIGNER_ROLE) signs a Voucher describing an impact collection + its commercial terms.
///         A buyer redeems it: pays, the platform fee + the NGO `beneficiary` are paid, and `amount` editions
///         are minted (lazily) to the buyer through TRWI. Nothing is minted before a buyer exists.
/// @dev    Voucher integrity is anchored at the TOKEN: TRWI cross-checks (creator,totalIV,metadataURI) against
///         the immutable EAS attestation, so a voucher can't contradict the verified impact. The platform
///         fee (`feeBps`) is part of the SIGNED voucher, so the buyer/NGO split can't be changed after
///         signing. Vouchers carry a `deadline` and a per-tokenId `nonce` so the platform can reprice/delist
///         by bumping the nonce. Payment currency must be NATIVE or on the admin allowlist.
contract RegenPrimarySale is AccessControl, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    address public constant NATIVE = address(0);
    uint96 public constant MAX_FEE_BPS = 1000; // 10%
    uint96 internal constant BPS = 10_000;

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "Voucher(uint256 tokenId,address creator,uint256 totalIV,uint256 maxEditions,uint256 pricePerEdition,address currency,address beneficiary,bytes32 easUID,string metadataURI,uint96 royaltyBps,uint96 feeBps,uint256 nonce,uint256 deadline)"
    );

    ITRWI public immutable trwi;
    address public feeRecipient;

    /// @notice Currencies accepted besides NATIVE. Allowlisting blocks fee-on-transfer/rebasing tokens that
    ///         would break the pay-in/pay-out accounting.
    mapping(address => bool) public allowedCurrency;

    /// @notice Per-collection voucher version; a voucher is valid only if `voucher.nonce == currentNonce[id]`.
    mapping(uint256 => uint256) public currentNonce;

    struct Voucher {
        uint256 tokenId;
        address creator; // NGO (TRWI checks == attestation.ngo)
        uint256 totalIV;
        uint256 maxEditions;
        uint256 pricePerEdition;
        address currency; // NATIVE or an allowlisted ERC-20
        address beneficiary; // NGO payout
        bytes32 easUID;
        string metadataURI;
        uint96 royaltyBps;
        uint96 feeBps; // platform fee for this sale, signed (<= MAX_FEE_BPS)
        uint256 nonce;
        uint256 deadline;
    }

    event Sold(
        uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 total, address currency
    );
    event NonceBumped(uint256 indexed tokenId, uint256 newNonce);
    event FeeRecipientUpdated(address feeRecipient);
    event CurrencyAllowed(address indexed currency, bool allowed);

    error BadParams();
    error Expired();
    error StaleVoucher();
    error BadSignature();
    error WrongPayment();
    error TransferFailed();
    error BadCurrency();

    constructor(address admin, address trwi_, address feeRecipient_) EIP712("RegenPrimarySale", "1") {
        if (admin == address(0) || trwi_ == address(0) || feeRecipient_ == address(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        trwi = ITRWI(trwi_);
        feeRecipient = feeRecipient_;
    }

    /// @notice Redeem a platform-signed voucher: pay, split fee + beneficiary, lazily mint to the buyer.
    function redeem(Voucher calldata v, uint256 amount, bytes calldata sig)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (amount == 0) revert BadParams();
        if (v.feeBps > MAX_FEE_BPS) revert BadParams();
        if (block.timestamp > v.deadline) revert Expired();
        if (v.nonce != currentNonce[v.tokenId]) revert StaleVoucher();
        if (v.currency != NATIVE && !allowedCurrency[v.currency]) revert BadCurrency();

        address signer = ECDSA.recover(_hashTypedDataV4(_voucherStructHash(v)), sig);
        if (!hasRole(SIGNER_ROLE, signer)) revert BadSignature();

        uint256 total = amount * v.pricePerEdition;
        if (v.currency == NATIVE) {
            if (msg.value != total) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
            IERC20(v.currency).safeTransferFrom(msg.sender, address(this), total);
        }

        uint256 fee = (total * v.feeBps) / BPS;
        _pay(v.currency, feeRecipient, fee);
        _pay(v.currency, v.beneficiary, total - fee);

        trwi.mint(
            ITRWI.MintParams({
                tokenId: v.tokenId,
                creator: v.creator,
                totalIV: v.totalIV,
                maxEditions: v.maxEditions,
                easUID: v.easUID,
                metadataURI: v.metadataURI,
                royaltyBps: v.royaltyBps
            }),
            msg.sender,
            amount
        );

        emit Sold(v.tokenId, msg.sender, amount, total, v.currency);
    }

    /// @notice Invalidate all outstanding vouchers for a collection (to reprice or delist).
    function bumpNonce(uint256 tokenId) external onlyRole(SIGNER_ROLE) {
        uint256 n = ++currentNonce[tokenId];
        emit NonceBumped(tokenId, n);
    }

    function setFeeRecipient(address feeRecipient_) external onlyRole(ADMIN_ROLE) {
        if (feeRecipient_ == address(0)) revert BadParams();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    function setCurrencyAllowed(address currency, bool allowed) external onlyRole(ADMIN_ROLE) {
        if (currency == NATIVE) revert BadCurrency(); // NATIVE is always accepted; nothing to toggle
        allowedCurrency[currency] = allowed;
        emit CurrencyAllowed(currency, allowed);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice EIP-712 digest for a voucher (off-chain signer + tests compute the same).
    function hashVoucher(Voucher calldata v) external view returns (bytes32) {
        return _hashTypedDataV4(_voucherStructHash(v));
    }

    function _voucherStructHash(Voucher calldata v) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                v.tokenId,
                v.creator,
                v.totalIV,
                v.maxEditions,
                v.pricePerEdition,
                v.currency,
                v.beneficiary,
                v.easUID,
                keccak256(bytes(v.metadataURI)),
                v.royaltyBps,
                v.feeBps,
                v.nonce,
                v.deadline
            )
        );
    }

    function _pay(address currency, address to, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        if (currency == NATIVE) {
            (bool ok,) = payable(to).call{ value: amount }("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(currency).safeTransfer(to, amount);
        }
    }
}

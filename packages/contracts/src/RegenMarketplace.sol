// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title  RegenMarketplace — escrow marketplace for tRWI (ERC-1155) editions
/// @notice Custody model: the lister escrows editions INTO this contract; tRWI never sits in an NGO's
///         personal wallet. On buy, editions go to the buyer and proceeds (minus platform fee and any
///         ERC-2981 royalty, the royalty capped at MAX_ROYALTY_BPS) are paid to the listing's `beneficiary`
///         (the NGO). Each listing carries its own price. Payment in native CELO (currency = address(0)) or
///         an allowlisted ERC-20.
/// @dev    Minimal, escrow-based, no upgradeability. checks-effects-interactions + ReentrancyGuard + Pausable
///         (entry paths pause; `cancel` always exits so escrow can't be trapped).
contract RegenMarketplace is AccessControl, ReentrancyGuard, Pausable, IERC1155Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    address public constant NATIVE = address(0); // sentinel: pay in the chain's native coin (CELO)
    uint96 public constant MAX_FEE_BPS = 1000; // platform fee hard cap = 10%
    uint96 public constant MAX_ROYALTY_BPS = 1000; // royalty hard cap honored on secondary sales = 10%
    uint96 internal constant BPS = 10_000;

    IERC1155 public immutable trwi;
    address public feeRecipient;
    uint96 public feeBps;

    /// @notice Currencies accepted besides NATIVE (blocks fee-on-transfer/rebasing tokens). Checked at list time.
    mapping(address => bool) public allowedCurrency;

    struct Listing {
        address seller; // escrowed the editions; can cancel
        address beneficiary; // receives sale proceeds (the NGO)
        uint256 tokenId;
        uint256 remaining; // editions still for sale
        uint256 pricePerEdition; // in `currency` units
        address currency; // NATIVE or an allowlisted ERC-20
        bool active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed beneficiary,
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerEdition,
        address currency
    );
    event Purchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 total);
    event Cancelled(uint256 indexed listingId, uint256 returnedAmount);
    event FeeUpdated(address feeRecipient, uint96 feeBps);
    event CurrencyAllowed(address indexed currency, bool allowed);

    error BadParams();
    error NotAvailable();
    error NotSeller();
    error WrongPayment();
    error TransferFailed();
    error BadCurrency();

    constructor(address admin, address trwi_, address feeRecipient_, uint96 feeBps_) {
        if (admin == address(0) || trwi_ == address(0) || feeRecipient_ == address(0)) revert BadParams();
        if (feeBps_ > MAX_FEE_BPS) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        trwi = IERC1155(trwi_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    /// @notice Escrow `amount` editions of `tokenId` for sale at `pricePerEdition` in `currency`.
    ///         Proceeds go to `beneficiary`. Caller must `setApprovalForAll(this, true)` first.
    function list(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerEdition,
        address currency,
        address beneficiary
    ) external nonReentrant whenNotPaused returns (uint256 listingId) {
        if (amount == 0 || pricePerEdition == 0 || beneficiary == address(0)) {
            revert BadParams();
        }
        if (currency != NATIVE && !allowedCurrency[currency]) revert BadCurrency();

        // effects
        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            beneficiary: beneficiary,
            tokenId: tokenId,
            remaining: amount,
            pricePerEdition: pricePerEdition,
            currency: currency,
            active: true
        });
        emit Listed(listingId, msg.sender, beneficiary, tokenId, amount, pricePerEdition, currency);

        // interactions last: pull into escrow (reverts the whole tx if the seller hasn't approved)
        trwi.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
    }

    /// @notice Buy `amount` editions from a listing. Pays fee + (capped) ERC-2981 royalty + beneficiary,
    ///         then delivers the editions to the buyer.
    function buy(uint256 listingId, uint256 amount) external payable nonReentrant whenNotPaused {
        Listing storage l = listings[listingId];
        if (!l.active || amount == 0 || amount > l.remaining) revert NotAvailable();

        uint256 total = amount * l.pricePerEdition;

        // ---- pull payment ----
        if (l.currency == NATIVE) {
            if (msg.value != total) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
            IERC20(l.currency).safeTransferFrom(msg.sender, address(this), total);
        }

        // ---- effects ----
        l.remaining -= amount;
        if (l.remaining == 0) l.active = false;

        // ---- split: platform fee, capped ERC-2981 royalty, remainder to beneficiary ----
        uint256 fee = (total * feeBps) / BPS;
        (address royaltyReceiver, uint256 royalty) = _royalty(l.tokenId, total);
        uint256 maxRoyalty = (total * MAX_ROYALTY_BPS) / BPS;
        if (royalty > maxRoyalty) royalty = maxRoyalty; // cap so a high royalty can't starve the beneficiary
        if (fee + royalty > total) royalty = total - fee; // never overpay (fee <= 10%, so total - fee >= 0)
        uint256 toBeneficiary = total - fee - royalty;

        // ---- interactions ----
        _pay(l.currency, feeRecipient, fee);
        if (royalty > 0) _pay(l.currency, royaltyReceiver, royalty);
        _pay(l.currency, l.beneficiary, toBeneficiary);
        trwi.safeTransferFrom(address(this), msg.sender, l.tokenId, amount, "");

        emit Purchased(listingId, msg.sender, amount, total);
    }

    /// @notice Cancel a listing and return escrowed editions to the seller (seller or admin). Always
    ///         available (no pause gate) so escrowed tRWI can never be trapped.
    function cancel(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        if (!l.active) revert NotAvailable();
        if (msg.sender != l.seller && !hasRole(ADMIN_ROLE, msg.sender)) revert NotSeller();
        uint256 rem = l.remaining;
        l.remaining = 0;
        l.active = false;
        trwi.safeTransferFrom(address(this), l.seller, l.tokenId, rem, "");
        emit Cancelled(listingId, rem);
    }

    function setFee(address feeRecipient_, uint96 feeBps_) external onlyRole(ADMIN_ROLE) {
        if (feeRecipient_ == address(0) || feeBps_ > MAX_FEE_BPS) revert BadParams();
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        emit FeeUpdated(feeRecipient_, feeBps_);
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

    // ---- internal ----

    function _royalty(uint256 tokenId, uint256 salePrice)
        internal
        view
        returns (address receiver, uint256 amount)
    {
        try IERC2981(address(trwi)).royaltyInfo(tokenId, salePrice) returns (address r, uint256 a) {
            if (r != address(0) && a > 0) return (r, a);
        } catch { }
        return (address(0), 0);
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

    // ---- ERC1155 receiver (escrow) ----
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 iid) public view override(AccessControl, IERC165) returns (bool) {
        return iid == type(IERC1155Receiver).interfaceId || super.supportsInterface(iid);
    }
}

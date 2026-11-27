// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { TRWIV4 } from "./TRWIV4.sol";

/// @title  RegenMarketplace version 2: resale of tRWI (revision 4) with the creator / platform / partner split
/// @notice A holder escrows editions here with a price. A buyer pays; in one transaction the creator gets the
///         impact's royalty share, Regen Bazaar its resale share, the partner its resale share (only if the
///         impact has a partner), and the seller the rest. All shares were fixed per impact at first sale in
///         TRWIV4 and cannot be edited here. Payment goes straight from the buyer to each payee: the contract
///         holds editions in escrow, never money. Withdrawn, revoked and non-transferable impact is refused.
///         The seller can always cancel, even while paused.
/// @dev    Roles: DEFAULT_ADMIN_ROLE = timelock; GUARDIAN_ROLE pauses only. Stablecoins on the allowlist only.
contract RegenMarketplaceV2 is AccessControl, ReentrancyGuard, Pausable, IERC1155Receiver {
    using SafeERC20 for IERC20;

    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    uint96 internal constant BPS = 10_000;

    TRWIV4 public immutable trwi;
    address public feeRecipient;
    mapping(address => bool) public allowedCurrency;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 remaining;
        uint256 pricePerEdition;
        address currency;
        bool active;
    }

    struct Split {
        uint256 total;
        uint256 creatorPaid;
        uint256 platformPaid;
        uint256 partnerPaid;
        uint256 sellerPaid;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;
    bool private _escrowing; // true only while list() pulls editions in

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerEdition,
        address currency
    );
    /// @notice One record per resale with every payout.
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 amount,
        address currency,
        uint256 total,
        uint256 sellerPaid,
        uint256 creatorPaid,
        uint256 platformPaid,
        uint256 partnerPaid
    );
    event Cancelled(uint256 indexed listingId, uint256 returnedAmount);
    event FeeRecipientUpdated(address feeRecipient);
    event CurrencyAllowed(address indexed currency, bool allowed);

    error BadParams();
    error NotAvailable();
    error NotSeller();
    error BadCurrency();
    error NotTradable();
    error UnexpectedTransfer();

    constructor(address admin, address trwi_, address feeRecipient_) {
        if (admin == address(0) || trwi_ == address(0) || feeRecipient_ == address(0)) revert BadParams();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        trwi = TRWIV4(trwi_);
        feeRecipient = feeRecipient_;
    }

    /// @notice Escrow `amount` editions at `pricePerEdition`. Needs `setApprovalForAll(this, true)` first.
    function list(uint256 tokenId, uint256 amount, uint256 pricePerEdition, address currency)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 listingId)
    {
        if (amount == 0 || pricePerEdition == 0) revert BadParams();
        if (!allowedCurrency[currency]) revert BadCurrency();
        if (!trwi.marketTerms(tokenId).tradable) revert NotTradable();

        listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            remaining: amount,
            pricePerEdition: pricePerEdition,
            currency: currency,
            active: true
        });
        emit Listed(listingId, msg.sender, tokenId, amount, pricePerEdition, currency);

        _escrowing = true;
        trwi.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        _escrowing = false;
    }

    /// @notice Buy `amount` editions of a listing and pay the split.
    function buy(uint256 listingId, uint256 amount) external nonReentrant whenNotPaused {
        Listing storage l = listings[listingId];
        if (!l.active || amount == 0 || amount > l.remaining) revert NotAvailable();
        TRWIV4.MarketTerms memory t = trwi.marketTerms(l.tokenId);
        if (!t.tradable) revert NotTradable();

        Split memory s = splitOf(t, amount * l.pricePerEdition);

        // ---- effects ----
        l.remaining -= amount;
        if (l.remaining == 0) l.active = false;

        // ---- interactions: buyer -> payees directly, then deliver ----
        IERC20 token = IERC20(l.currency);
        if (s.platformPaid != 0) token.safeTransferFrom(msg.sender, feeRecipient, s.platformPaid);
        if (s.creatorPaid != 0) token.safeTransferFrom(msg.sender, t.creator, s.creatorPaid);
        if (s.partnerPaid != 0) token.safeTransferFrom(msg.sender, t.partner, s.partnerPaid);
        if (s.sellerPaid != 0) token.safeTransferFrom(msg.sender, l.seller, s.sellerPaid);
        trwi.safeTransferFrom(address(this), msg.sender, l.tokenId, amount, "");

        emit Purchased(
            listingId,
            msg.sender,
            l.tokenId,
            amount,
            l.currency,
            s.total,
            s.sellerPaid,
            s.creatorPaid,
            s.platformPaid,
            s.partnerPaid
        );
    }

    /// @notice Return escrowed editions to the seller (seller or admin). Never paused, so escrow can't be
    ///         trapped; works for withdrawn impact too.
    function cancel(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        if (!l.active) revert NotAvailable();
        if (msg.sender != l.seller && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert NotSeller();
        uint256 rem = l.remaining;
        l.remaining = 0;
        l.active = false;
        trwi.safeTransferFrom(address(this), l.seller, l.tokenId, rem, "");
        emit Cancelled(listingId, rem);
    }

    /// @notice The resale split for `total`. Shares round down; the seller gets the remainder, so the payouts
    ///         always sum to `total`. No partner means no partner payment.
    function splitOf(TRWIV4.MarketTerms memory t, uint256 total) public pure returns (Split memory s) {
        s.total = total;
        s.creatorPaid = (total * t.royaltyBps) / BPS;
        s.platformPaid = (total * t.resaleFeeBps) / BPS;
        s.partnerPaid = t.partner == address(0) ? 0 : (total * t.resalePartnerBps) / BPS;
        s.sellerPaid = total - s.creatorPaid - s.platformPaid - s.partnerPaid;
    }

    function quote(uint256 listingId, uint256 amount) external view returns (Split memory) {
        Listing storage l = listings[listingId];
        return splitOf(trwi.marketTerms(l.tokenId), amount * l.pricePerEdition);
    }

    function setFeeRecipient(address feeRecipient_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeRecipient_ == address(0)) revert BadParams();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

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

    // ---- ERC-1155 receiver: accept tRWI only, and only through list() ----

    function onERC1155Received(address operator, address, uint256, uint256, bytes calldata)
        external
        view
        returns (bytes4)
    {
        if (msg.sender != address(trwi) || operator != address(this) || !_escrowing) revert UnexpectedTransfer();
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert UnexpectedTransfer();
    }

    function supportsInterface(bytes4 iid) public view override(AccessControl, IERC165) returns (bool) {
        return iid == type(IERC1155Receiver).interfaceId || super.supportsInterface(iid);
    }
}

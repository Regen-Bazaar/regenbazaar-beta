// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface ITRWI is IERC1155 {
    function impactValueOf(uint256 id, uint256 amount) external view returns (uint256);
}

interface IREBAZMinter {
    function mint(address to, uint256 amount) external;
}

/// @title  tRWIStaking — stake tRWI editions to earn $REBAZ
/// @notice Rewards accrue on the staked impact value (IV), boosted by a lock-tier multiplier.
/// @dev    Reward accounting uses a global cumulative index (`rewardIndex` = Σ baseRewardRateBps·seconds).
///         A rate change settles the index first, so it is NEVER retroactive: already-elapsed time keeps
///         the rate that was in force. Rewards are a per-stake APR on IV (not pool-diluted), so no global
///         total or division-by-zero is involved. Reward token is minted on demand (capped at the REBAZ
///         level); `emergencyUnstake` always returns principal even if minting is broken or the contract
///         is paused, so staked tRWI can never be trapped. Immutable (no proxy) for safety.
contract TRWIStaking is IERC1155Receiver, AccessControl, ReentrancyGuard, Pausable {
    using EnumerableSet for EnumerableSet.UintSet;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant BPS = 10_000;
    /// @notice Sanity ceiling on the annual base reward rate (100%/yr) — bounds admin reward-rate changes.
    uint256 public constant MAX_REWARD_RATE_BPS = 10_000;

    ITRWI public immutable trwi;
    IREBAZMinter public immutable rebaz;

    /// @notice annual reward rate on staked IV, in bps (e.g. 1000 = 10%/yr at the base, no-lock tier).
    uint256 public baseRewardRateBps;

    /// @notice Global cumulative reward index = Σ (baseRewardRateBps · secondsElapsed) over all rate epochs.
    uint256 public rewardIndex;
    /// @notice Timestamp the index was last settled into `rewardIndex`.
    uint64 public lastUpdate;

    struct Stake {
        address owner;
        uint256 tokenId;
        uint256 amount;
        uint256 ivStaked; // snapshot of impactValueOf(tokenId, amount) at stake time
        uint256 indexSnapshot; // rewardIndex captured at stake / last claim
        uint64 start;
        uint64 lockEnd;
        uint32 multiplierBps;
    }

    uint256 public nextStakeId = 1;
    mapping(uint256 => Stake) public stakes;
    mapping(address => EnumerableSet.UintSet) private _userStakes;

    event Staked(
        uint256 indexed stakeId,
        address indexed owner,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 ivStaked,
        uint64 lockEnd,
        uint32 multiplierBps
    );
    event Claimed(uint256 indexed stakeId, address indexed owner, uint256 reward);
    event Unstaked(uint256 indexed stakeId, address indexed owner, uint256 tokenId, uint256 amount);
    event EmergencyUnstaked(uint256 indexed stakeId, address indexed owner, uint256 tokenId, uint256 amount);
    event RewardRateChanged(uint256 bps);

    error NotStakeOwner();
    error StillLocked();
    error BadLock();
    error ZeroAmount();
    error RateTooHigh();

    constructor(address admin, address trwi_, address rebaz_, uint256 baseRewardRateBps_) {
        require(admin != address(0) && trwi_ != address(0) && rebaz_ != address(0), "zero addr");
        require(baseRewardRateBps_ <= MAX_REWARD_RATE_BPS, "rate too high");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        trwi = ITRWI(trwi_);
        rebaz = IREBAZMinter(rebaz_);
        baseRewardRateBps = baseRewardRateBps_;
        lastUpdate = uint64(block.timestamp);
    }

    /// @dev Lock tiers: none=1x, 30d=1.2x, 90d=1.5x, 180d=2x, 365d=3x. Non-zero locks below 30d rejected.
    function multiplierFor(uint64 lockPeriod) public pure returns (uint32) {
        if (lockPeriod == 0) return 10_000;
        if (lockPeriod >= 365 days) return 30_000;
        if (lockPeriod >= 180 days) return 20_000;
        if (lockPeriod >= 90 days) return 15_000;
        if (lockPeriod >= 30 days) return 12_000;
        revert BadLock();
    }

    /// @notice Stake `amount` editions of `tokenId` for `lockPeriod` seconds. Requires prior setApprovalForAll.
    function stake(uint256 tokenId, uint256 amount, uint64 lockPeriod)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 stakeId)
    {
        if (amount == 0) revert ZeroAmount();
        uint32 mult = multiplierFor(lockPeriod);
        uint256 iv = trwi.impactValueOf(tokenId, amount);

        _settleIndex();

        stakeId = nextStakeId++;
        uint64 nowTs = uint64(block.timestamp);
        stakes[stakeId] = Stake({
            owner: msg.sender,
            tokenId: tokenId,
            amount: amount,
            ivStaked: iv,
            indexSnapshot: rewardIndex,
            start: nowTs,
            lockEnd: nowTs + lockPeriod,
            multiplierBps: mult
        });
        _userStakes[msg.sender].add(stakeId);
        emit Staked(stakeId, msg.sender, tokenId, amount, iv, nowTs + lockPeriod, mult);

        // interactions last (checks-effects-interactions)
        trwi.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
    }

    /// @notice Reward accrued but unclaimed for `stakeId` (read-only; extrapolates at the current rate).
    function pendingReward(uint256 stakeId) public view returns (uint256) {
        Stake memory s = stakes[stakeId];
        if (s.owner == address(0)) return 0;
        return _rewardFor(s, _accIndex());
    }

    function claim(uint256 stakeId) external nonReentrant whenNotPaused returns (uint256 reward) {
        Stake storage s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStakeOwner();
        _settleIndex();
        reward = _rewardFor(s, rewardIndex);
        s.indexSnapshot = rewardIndex;
        if (reward > 0) rebaz.mint(msg.sender, reward);
        emit Claimed(stakeId, msg.sender, reward);
    }

    /// @notice Unstake after the lock, claiming accrued rewards. If reward minting is unavailable, use
    ///         `emergencyUnstake` to recover principal (forfeiting rewards).
    function unstake(uint256 stakeId) external nonReentrant whenNotPaused {
        Stake storage s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStakeOwner();
        if (block.timestamp < s.lockEnd) revert StillLocked();

        _settleIndex();
        uint256 reward = _rewardFor(s, rewardIndex);
        uint256 tokenId = s.tokenId;
        uint256 amount = s.amount;
        _userStakes[msg.sender].remove(stakeId);
        delete stakes[stakeId];

        if (reward > 0) rebaz.mint(msg.sender, reward);
        trwi.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        emit Claimed(stakeId, msg.sender, reward);
        emit Unstaked(stakeId, msg.sender, tokenId, amount);
    }

    /// @notice Recover staked principal WITHOUT claiming rewards. Always callable so tRWI can never be
    ///         trapped — even if REBAZ minting is revoked/capped. The lock is enforced in normal operation
    ///         but bypassed while the contract is paused (an incident), since a pause itself is the emergency.
    function emergencyUnstake(uint256 stakeId) external nonReentrant {
        Stake storage s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStakeOwner();
        if (!paused() && block.timestamp < s.lockEnd) revert StillLocked();

        uint256 tokenId = s.tokenId;
        uint256 amount = s.amount;
        _userStakes[msg.sender].remove(stakeId);
        delete stakes[stakeId];

        trwi.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
        emit EmergencyUnstaked(stakeId, msg.sender, tokenId, amount);
    }

    /// @notice Active stake IDs for a user (removed on unstake/emergencyUnstake).
    function userStakes(address u) external view returns (uint256[] memory) {
        return _userStakes[u].values();
    }

    function setBaseRewardRate(uint256 bps) external onlyRole(ADMIN_ROLE) {
        if (bps > MAX_REWARD_RATE_BPS) revert RateTooHigh();
        _settleIndex(); // bank accrual at the old rate first — never retroactive
        baseRewardRateBps = bps;
        emit RewardRateChanged(bps);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ---- reward index internals ----

    /// @dev Index extrapolated to `block.timestamp` at the current rate (read-only).
    function _accIndex() internal view returns (uint256) {
        return rewardIndex + baseRewardRateBps * (block.timestamp - lastUpdate);
    }

    /// @dev Bank the accrued index up to now; subsequent rate changes only affect future time.
    function _settleIndex() internal {
        rewardIndex = _accIndex();
        lastUpdate = uint64(block.timestamp);
    }

    /// @dev reward = ivStaked · multiplier · (idx − snapshot) / (BPS · BPS · SECONDS_PER_YEAR).
    function _rewardFor(Stake memory s, uint256 idx) internal pure returns (uint256) {
        return (s.ivStaked * s.multiplierBps * (idx - s.indexSnapshot)) / (BPS * BPS * SECONDS_PER_YEAR);
    }

    // ---- ERC1155 receiver ----
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

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITRWI is IERC1155 {
    function impactValueOf(uint256 id, uint256 amount) external view returns (uint256);
}

interface IREBAZMinter {
    function mint(address to, uint256 amount) external;
}

/// @title  tRWIStaking — stake tRWI editions to earn $REBAZ
/// @notice Rewards accrue on the staked impact value (IV), boosted by a lock-tier multiplier.
/// @dev    PLACEHOLDER testnet economics (mint-based rewards; rate/tiers tunable). Designed to be
///         swappable to a funded-reserve model later. Immutable (no proxy) for safety.
contract TRWIStaking is IERC1155Receiver, AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant BPS = 10_000;

    ITRWI public immutable trwi;
    IREBAZMinter public immutable rebaz;

    /// @notice annual reward rate on staked IV, in bps (e.g. 1000 = 10%/yr at the base, no-lock tier).
    uint256 public baseRewardRateBps;

    struct Stake {
        address owner;
        uint256 tokenId;
        uint256 amount;
        uint256 ivStaked; // snapshot of impactValueOf(tokenId, amount) at stake time
        uint64 start;
        uint64 lockEnd;
        uint64 lastClaim;
        uint32 multiplierBps;
    }

    uint256 public nextStakeId = 1;
    mapping(uint256 => Stake) public stakes;
    mapping(address => uint256[]) internal _userStakes;

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

    error NotStakeOwner();
    error StillLocked();
    error BadLock();
    error ZeroAmount();

    constructor(address admin, address trwi_, address rebaz_, uint256 baseRewardRateBps_) {
        require(admin != address(0) && trwi_ != address(0) && rebaz_ != address(0), "zero addr");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        trwi = ITRWI(trwi_);
        rebaz = IREBAZMinter(rebaz_);
        baseRewardRateBps = baseRewardRateBps_;
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
        returns (uint256 stakeId)
    {
        if (amount == 0) revert ZeroAmount();
        uint32 mult = multiplierFor(lockPeriod);
        uint256 iv = trwi.impactValueOf(tokenId, amount);

        trwi.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        stakeId = nextStakeId++;
        uint64 nowTs = uint64(block.timestamp);
        stakes[stakeId] = Stake({
            owner: msg.sender,
            tokenId: tokenId,
            amount: amount,
            ivStaked: iv,
            start: nowTs,
            lockEnd: nowTs + lockPeriod,
            lastClaim: nowTs,
            multiplierBps: mult
        });
        _userStakes[msg.sender].push(stakeId);
        emit Staked(stakeId, msg.sender, tokenId, amount, iv, nowTs + lockPeriod, mult);
    }

    function pendingReward(uint256 stakeId) public view returns (uint256) {
        Stake memory s = stakes[stakeId];
        if (s.owner == address(0)) return 0;
        uint256 elapsed = block.timestamp - s.lastClaim;
        return (s.ivStaked * baseRewardRateBps * s.multiplierBps * elapsed) / (SECONDS_PER_YEAR * BPS * BPS);
    }

    function claim(uint256 stakeId) external nonReentrant returns (uint256 reward) {
        Stake storage s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStakeOwner();
        reward = pendingReward(stakeId);
        s.lastClaim = uint64(block.timestamp);
        if (reward > 0) rebaz.mint(msg.sender, reward);
        emit Claimed(stakeId, msg.sender, reward);
    }

    function unstake(uint256 stakeId) external nonReentrant {
        Stake storage s = stakes[stakeId];
        if (s.owner != msg.sender) revert NotStakeOwner();
        if (block.timestamp < s.lockEnd) revert StillLocked();

        uint256 reward = pendingReward(stakeId);
        uint256 tokenId = s.tokenId;
        uint256 amount = s.amount;
        delete stakes[stakeId];

        if (reward > 0) rebaz.mint(msg.sender, reward);
        trwi.safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        emit Claimed(stakeId, msg.sender, reward);
        emit Unstaked(stakeId, msg.sender, tokenId, amount);
    }

    function userStakes(address u) external view returns (uint256[] memory) {
        return _userStakes[u];
    }

    function setBaseRewardRate(uint256 bps) external onlyRole(ADMIN_ROLE) {
        baseRewardRateBps = bps;
    }

    // ---- ERC1155 receiver ----
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
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

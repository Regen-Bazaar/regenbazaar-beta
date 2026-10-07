#!/bin/zsh
# Arc mainnet: buy one tRWI share for 0.01 USDC against the 2026-10-07 deployment.
# Uses cast, not forge script: forge's local EVM lacks Arc's USDC blocklist precompile (0x1800..01),
# so any USDC transfer reverts in its pre-broadcast simulation. cast lets the Arc node execute.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=https://rpc.mainnet.arc.io
EXPECTED=0x303265Ac916CcD8844E2BD2a61c6522b19f19EcB
USDC=0x3600000000000000000000000000000000000000
TRWI=0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030
SALE=0x1D4513a40a8DF2046899d72a6634c8eEa9ffbDdE
EAS_UID=0x2b4c9374b8cdab10b8aba0c35f3a3bbffe47b011898ea3eab69b2ef998176ce5 # real UID, tx 0xdeadd7d0…
PRICE=10000 # 0.01 USDC (6 decimals)
T="(uint256,address,uint256,uint256,uint256,address,address,bytes32,string,uint96,uint96,address,uint96,uint256,uint256)"

read -s "PK?Deployer private key (hidden): "; echo
PK=${PK//[[:space:]]/}
[[ "$PK" == 0x* ]] || PK="0x$PK"
ME=$(cast wallet address "$PK")
[[ "${ME:l}" == "${EXPECTED:l}" ]] || { echo "Not the expected deployer $EXPECTED. Stopping."; exit 1; }
cast chain-id --rpc-url $RPC >/dev/null || { echo "Arc RPC unreachable, try again in a minute. Nothing was sent."; exit 1; }

NONCE=$(cast call $SALE "currentNonce(uint256)(uint256)" 1 --rpc-url $RPC | awk '{print $1}')
DEADLINE=$(( $(date +%s) + 3600 ))
V="(1,$ME,1000000000000000000000,100,$PRICE,$USDC,$ME,$EAS_UID,ipfs://smoke-arc,500,250,0x0000000000000000000000000000000000000000,0,$NONCE,$DEADLINE)"
DIGEST=$(cast call $SALE "hashVoucher($T)(bytes32)" "$V" --rpc-url $RPC)
SIG=$(cast wallet sign --no-hash --private-key "$PK" "$DIGEST")

echo "== 1/3 approve 0.01 USDC"
cast send $USDC "approve(address,uint256)" $SALE $PRICE --private-key "$PK" --rpc-url $RPC | grep -E "^(status|transactionHash)"

echo "== 2/3 dry run on the Arc node (no gas spent)"
cast call $SALE "redeem($T,uint256,bytes)" "$V" 1 "$SIG" --from "$ME" --rpc-url $RPC >/dev/null \
  || { echo "Dry run reverted. Stopping before paying. Approve of 0.01 USDC stays, harmless."; exit 1; }
echo "dry run OK"

echo "== 3/3 redeem 1 share"
cast send $SALE "redeem($T,uint256,bytes)" "$V" 1 "$SIG" --private-key "$PK" --rpc-url $RPC | grep -E "^(status|transactionHash|gasUsed)"

unset PK
BAL=$(cast call $TRWI "balanceOf(address,uint256)(uint256)" "$ME" 1 --rpc-url $RPC | awk '{print $1}')
echo "tRWI #1 balance: $BAL"
[[ "$BAL" == "1" ]] && echo "SMOKE OK. Tell Claude: done" || echo "Balance is not 1. Tell Claude."

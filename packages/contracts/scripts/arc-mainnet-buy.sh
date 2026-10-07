#!/bin/zsh
# Arc mainnet: step 3 only, buy one tRWI share for 0.01 USDC against the 2026-10-07 deployment.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=https://rpc.mainnet.arc.io
EXPECTED=0x303265Ac916CcD8844E2BD2a61c6522b19f19EcB
export ARC_USDC=0x3600000000000000000000000000000000000000
export ARC_EAS=0x6446Cf9161F58A3FadEf2f3711265054c5DA84aC
export ARC_TRWI=0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030
export ARC_SALE=0x1D4513a40a8DF2046899d72a6634c8eEa9ffbDdE
export ARC_SCHEMA_UID=0xfe0a11249a41ddf3f879036e89b0c82d2e954b625467cb189461b0897494e2fc
export SMOKE_EAS_UID=0x2b4c9374b8cdab10b8aba0c35f3a3bbffe47b011898ea3eab69b2ef998176ce5 # real UID, tx 0xdeadd7d0…

read -s "DEPLOYER_PRIVATE_KEY?Deployer private key (hidden): "; echo
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY//[[:space:]]/}
[[ "$DEPLOYER_PRIVATE_KEY" == 0x* ]] || DEPLOYER_PRIVATE_KEY="0x$DEPLOYER_PRIVATE_KEY"
export DEPLOYER_PRIVATE_KEY
ME=$(cast wallet address "$DEPLOYER_PRIVATE_KEY")
[[ "${ME:l}" == "${EXPECTED:l}" ]] || { echo "Not the expected deployer $EXPECTED. Stopping."; exit 1; }

cast chain-id --rpc-url $RPC >/dev/null || { echo "Arc RPC unreachable, try again in a minute. Nothing was sent."; exit 1; }

echo "== buy one share for 0.01 USDC"
forge script script/SmokeArc.s.sol --rpc-url $RPC --broadcast 2>&1 | tee -a arc-mainnet-deploy.log

unset DEPLOYER_PRIVATE_KEY
echo "DONE. Tell Claude: done"

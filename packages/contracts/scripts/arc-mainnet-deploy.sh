#!/bin/zsh
# Arc mainnet: market-only deploy + one USDC share purchase. Run by the owner in their own terminal.
# The key is read silently, never echoed or written to disk/history.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=https://rpc.mainnet.arc.io
USDC=0x3600000000000000000000000000000000000000
EXPECTED=0x303265Ac916CcD8844E2BD2a61c6522b19f19EcB
MIN_BASE_UNITS=400000 # 0.40 USDC: ~0.22 needed + forge's 130% gas estimate margin

read -s "DEPLOYER_PRIVATE_KEY?Deployer private key (hidden): "; echo
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY//[[:space:]]/}
# forge's vm.envUint needs the 0x prefix; cast accepts either
[[ "$DEPLOYER_PRIVATE_KEY" == 0x* ]] || DEPLOYER_PRIVATE_KEY="0x$DEPLOYER_PRIVATE_KEY"
export DEPLOYER_PRIVATE_KEY
ME=$(cast wallet address "$DEPLOYER_PRIVATE_KEY")
echo "Deployer: $ME"
if [[ "${ME:l}" != "${EXPECTED:l}" ]]; then
  echo "Not the expected deployer $EXPECTED. Stopping."; exit 1
fi

BAL=$(cast call $USDC 'balanceOf(address)(uint256)' "$ME" --rpc-url $RPC | awk '{print $1}')
echo "USDC on Arc: $BAL (6 decimals)"
if (( BAL < MIN_BASE_UNITS )); then
  echo "Need at least 0.40 USDC on Arc at $ME. Top up, then rerun. Nothing was sent."; exit 1
fi

LOG=arc-mainnet-deploy.log
echo "== 1/3 deploy"
forge script script/DeployArcMarket.s.sol --rpc-url $RPC --broadcast 2>&1 | tee $LOG

export ARC_USDC=$USDC
export ARC_EAS=$(grep -E '^\s+EAS\s+0x' $LOG | grep -oE '0x[0-9a-fA-F]{40}')
export ARC_TRWI=$(grep -E 'TRWI proxy' $LOG | grep -oE '0x[0-9a-fA-F]{40}')
export ARC_SALE=$(grep -E 'RegenPrimarySale v2' $LOG | grep -oE '0x[0-9a-fA-F]{40}')
export ARC_SCHEMA_UID=$(grep -A1 'ImpactClaim schemaUID' $LOG | grep -oE '0x[0-9a-fA-F]{64}' | head -1)
echo "EAS=$ARC_EAS TRWI=$ARC_TRWI SALE=$ARC_SALE SCHEMA=$ARC_SCHEMA_UID"
[[ -n "$ARC_EAS" && -n "$ARC_TRWI" && -n "$ARC_SALE" && -n "$ARC_SCHEMA_UID" ]] || { echo "Could not read addresses from $LOG. Stopping."; exit 1; }

echo "== 2/3 attest"
forge script script/SmokeArc.s.sol --rpc-url $RPC --broadcast 2>&1 | tee -a $LOG
# the UID logged by forge is from the simulation; take the real one from the mined Attested event (data word)
export SMOKE_EAS_UID=$(python3 -c "import json;r=json.load(open('broadcast/SmokeArc.s.sol/5042/run-latest.json'))['receipts'][-1];print(r['logs'][-1]['data'][:66])")
[[ -n "$SMOKE_EAS_UID" ]] || { echo "No attestation UID. Stopping."; exit 1; }

echo "== 3/3 buy one share for 0.01 USDC"
forge script script/SmokeArc.s.sol --rpc-url $RPC --broadcast 2>&1 | tee -a $LOG

unset DEPLOYER_PRIVATE_KEY
echo "DONE. Tell Claude: done (log: packages/contracts/$LOG)"

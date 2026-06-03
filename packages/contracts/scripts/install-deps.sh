#!/usr/bin/env bash
# Fetch Foundry dependencies at pinned versions into lib/ (which is gitignored — not vendored, not
# submodules). Run once after a fresh clone, before `forge build`/`forge test`. Idempotent: skips deps
# already present. CI uses this same script.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p lib

clone() { # url dir [ref]
  if [ -d "lib/$2" ]; then echo "lib/$2 present — skip"; return 0; fi
  echo "cloning $2 ${3:+@ $3}"
  git clone --quiet "$1" "lib/$2"
  if [ -n "${3:-}" ]; then git -C "lib/$2" checkout --quiet "$3"; fi
}

clone https://github.com/foundry-rs/forge-std forge-std v1.9.6
clone https://github.com/OpenZeppelin/openzeppelin-contracts openzeppelin-contracts v5.1.0
clone https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable openzeppelin-contracts-upgradeable v5.1.0
clone https://github.com/ethereum-attestation-service/eas-contracts eas-contracts aa47c22

echo "contract deps ready."

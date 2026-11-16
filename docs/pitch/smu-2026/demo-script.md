# SMU Web3 for Social Good 2026 · live demo script (4:00)

Final: Thu 26.11.2026, Tech Track slot 7, 16:00–16:15 SGT (15:00 Da Nang), Zoom. The demo sits inside the
10-minute pitch (slides owned by the `smu-pitch-deck` session). Speaker: Paul.

## What the demo proves (4 points, match the slides)

1. **AI reads, it never scores.** The creator writes plain text; an LLM lists the actions; the Impact Value is a
   deterministic, published formula (same input, same number), shown with its full breakdown.
2. **A human validator sets the proof level** and approves; approval writes an **EAS attestation** on-chain and pins
   the token metadata to **IPFS**.
3. **The price comes from the Impact Value** (IV × rate × proof level × bounded cost coefficient), and a purchase
   **splits the payment on-chain in one transaction**: creator 97.5% / platform 2.5% (or a partner share).
4. **The buyer retires an edition in their name**: burned on-chain, permanent, visible in the explorer. Plus: the
   same sale contract is **live on Arc mainnet with real USDC** (one real purchase tx).

## Network

**Arbitrum Sepolia** (the app's default network). Why: fastest confirmations of our three testnets, the payment
token is our tUSDG stand-in with a public `mint()`, so the demo wallet funds itself in one click and nothing waits
on an external faucet. Arc mainnet is shown only as proof (an existing tx), no live mainnet action.

## Pre-demo setup (do on Tue 24.11 and again 30 min before the slot)

| # | What | Who |
|---|---|---|
| 1 | Chrome profile "RB demo" with **MetaMask** installed. Import the demo wallet from `~/RB_demo_wallet_TESTNET_ONLY.txt` (Import account → private key). Add network Arbitrum Sepolia (chain 421614, RPC `https://sepolia-rollup.arbitrum.io/rpc`). | Paul |
| 2 | Run `~/RB_demo_fund.sh` once (sends 0.01 test ETH from the deployer to the demo wallet; enough for ~100 txs). | Paul |
| 3 | On app.regenbazaar.com connect the demo wallet, Marketplace → **Get 100 test tUSDG** (one tx). | Paul or Claude |
| 4 | Server LLM key works: one test submission goes through (no "moderation unavailable"). | Claude |
| 5 | **Backup listing**: one report submitted and approved in advance (`Mangrove planting & beach cleanup, Da Nang (demo backup)`), not bought yet. Used if the live submit or approve hangs. | Claude |
| 6 | **Backup holding**: the demo wallet already holds 1 edition of another listing, so *My impact → Retire* works even if the live buy fails. | Claude |
| 7 | Open these tabs in order, in the "RB demo" profile, browser zoom 110%, window 1440×900, dark theme off: | Paul |
|   | T1 `app.regenbazaar.com/tokenize` · T2 `app.regenbazaar.com/verify` (**unlocked** with the reviewer code, the code lives in the tab session) · T3 `app.regenbazaar.com/marketplace` · T4 `app.regenbazaar.com/portfolio` · T5 Arc proof tx `https://explorer.arc.io/tx/0x3f168361af0e580ade9bc6849d8df46e03adbf6c91c0ca54852adfa7fd502be3` · T6 the backup recording (local file) | |
| 8 | Text to paste is in the clipboard manager or a notes window off-screen (below). MetaMask notifications on, other extensions' popups off, Do Not Disturb on. | Paul |
| 9 | Zoom: share **the Chrome window only** (not the screen), so MetaMask popups show (they open as separate windows: share screen instead if they do not appear in rehearsal). | Paul |

Text to paste (creator report):

```
Title: Beach cleanup and mangrove planting, Da Nang
On 8 November 2026, 25 volunteers cleaned 1.2 km of My Khe beach in Da Nang and collected 420 kg of plastic waste. The same day we planted 1,500 mangrove seedlings on 0.6 ha at the Cam Thanh wetland and ran a workshop for 40 school students on ocean plastic.
Proof link: https://www.regenbazaar.com/
```

## Script

Timings are cumulative. Spoken lines in quotes; actions in brackets.

### 0:00–0:15 · Frame (T1)
"Let me show it live on Arbitrum Sepolia. Three people: a creator who already did the work, a validator, and a buyer."

### 0:15–1:05 · Creator reports finished work (T1, Tokenize impact)
- [Paste title and the report text in step 1.]
  "A beach-cleanup group writes what they did, in plain words. No forms of carbon methodology."
- [Point at the preview card on the right: Environment score and price update as you type.]
  "The preview is our deterministic engine: published weights, same input, same number."
- [Step 2 Check actions: type **0.6** in *Planted area, ha*.]
  "We found mangroves, waste and volunteers in the text. The creator adds the planted area, so carbon can count."
- [Step 4 Proof: paste the link. Step 6 Review: **Submit for verification** (5–15 s).]
  "On submit, an LLM reads the text a second time on the server and a moderation check runs. The LLM only lists
  actions and numbers; it never sets the score."

### 1:05–1:50 · Validator approves (T2, Verification queue, already unlocked)
- [Reload; the new report is on top.]
  "The validator sees the AI reading next to the creator's numbers, the engine's flags and the proof links."
- [Proof level → **P2** (link plus photo/second source). **Approve** (5–15 s).]
  "The validator sets the proof level; that is human judgement, not AI. Approve writes an EAS attestation on-chain
  and pins the metadata to IPFS."
- [Click **Attestation transaction ↗** (Blockscout opens), show the tx, close the tab.]

### 1:50–2:50 · Buyer purchases (T2 → listing)
- [**View listing**.]
  "This is the listing. Impact Value with the full breakdown; the price is IV times the rate, times the proof level,
  times a bounded cost coefficient. 100 editions."
- [Point at *Payment goes to: creator 97.5% · platform 2.5%*; click **open** next to *Metadata (IPFS)*, show JSON, back.]
- [**Buy this impact** → MetaMask: approve tUSDG → confirm; then redeem → confirm (2 popups, ~10 s).]
  "One transaction mints the edition to the buyer and splits the payment: 97.5% straight to the creator's wallet,
  2.5% to the platform. No custody."
- [**Bought ✓ · view tx** → Blockscout: show *Token transfers*: tUSDG to creator, tUSDG to platform, tRWI to buyer.]

### 2:50–3:30 · Retire in the buyer's name (T4, My impact)
- [Reload. Show *Impact Value owned*. **Retire 1 edition** → MetaMask confirm (~5 s) → **Retirement transaction ↗**.]
  "Retiring burns the edition: the impact is now claimed in the buyer's name, permanently, and cannot be sold twice."

### 3:30–4:00 · Mainnet proof and close (T5)
- [Show the Arc mainnet tx.]
  "The same sale contract runs on Arc mainnet with real USDC; this is a real purchase. Regen Bazaar sells impact that
  already happened: the creator gets paid for done work, the buyer gets a verifiable, retirable claim."

## Fallbacks

| If | Then | Cost |
|---|---|---|
| Submit spins > 20 s or errors | Say "the LLM provider is slow, here is the same report submitted this morning", go to T2 and approve the **backup** report. | 0 s |
| Approve spins > 20 s | Open the backup listing (already approved), continue with Buy. | +5 s |
| MetaMask popup does not appear | Click the MetaMask icon in the toolbar; pending requests are there. | +5 s |
| Buy tx pending > 20 s | Say "Arbitrum Sepolia is congested", go to T4 and retire the **backup holding**; open a past purchase tx from the listing's *token on explorer* link. | +10 s |
| Retire hangs | Show the Arc mainnet tx (T5) and close. | 0 s |
| Site down or Zoom share fails | Play the backup recording (T6) and narrate over it. | 0 s |

## Backup recording

A full run of this script, recorded on Tue 24.11 after the second clean rehearsal: macOS **Cmd+Shift+5 → Record
Selected Portion** (the Chrome window, 1440×900), microphone off, saved as `~/Desktop/RB_SMU_demo_backup.mov`.
Narrate live over it if it is needed.

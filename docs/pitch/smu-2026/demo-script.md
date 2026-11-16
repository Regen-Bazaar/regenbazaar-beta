# SMU Web3 for Social Good 2026 · live demo script (4:00, talk slot 3:30–7:30)

Final: Thu 26.11.2026, Tech Track slot 7, 16:00–16:15 SGT (15:00 Da Nang), Zoom. The demo sits inside the
10-minute pitch (slides owned by the `smu-pitch-deck` session). Speaker: Paul.

## What the demo proves (4 points, match the slides)

1. **AI reads, it never scores.** The creator writes plain text; an LLM lists the actions; the Impact Value is a
   deterministic, published formula (same input, same number), shown with its full breakdown.
2. **A human validator sets the proof level** and approves; approval writes an **EAS attestation** on-chain and pins
   the token metadata to **IPFS**.
3. **The price comes from the Impact Value** (IV × rate × proof level × bounded cost coefficient), and a purchase
   **splits the payment on-chain in one transaction**: creator 97.5% / platform 2.5% (or a partner share).
4. **The buyer retires an edition in their name**: burned on-chain, permanent, visible in the explorer. (The Arc
   mainnet real-USDC purchase is shown on the traction slide after the demo, not in the demo.)

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

Slot 3:30–7:30 of the 10-minute talk. The slides before already explain EAS, IPFS, the split and the IV formula,
so the demo only shows them. The demo ends on the retirement tx in the explorer; the Arc mainnet tx moves to the
traction slide right after. Timings below are from the start of the demo (cumulative). Spoken lines in quotes;
actions in brackets.

### 0:00–0:10 · Handover (T1)
"Let me show you, live on Arbitrum Sepolia: a creator, a validator, a buyer."

### 0:10–1:00 · Creator reports finished work (T1, Tokenize impact) · 50 s
- [Paste title and the report text in step 1.] "A beach-cleanup group writes what they did, in plain words."
- [Point at the preview card: score and price update as you type.] "That number is the formula, not the AI."
- [Step 2: type **0.6** in *Planted area, ha*.] "The creator adds the planted area, so carbon can count."
- [Step 4: paste the proof link. Step 6: **Submit for verification** (5–15 s).]
  "On submit an LLM reads the text again on the server: it lists actions, it never sets the score."

### 1:00–1:50 · Validator approves (T2, Verification queue, already unlocked) · 50 s
- [Reload; new report on top.] "The validator sees the AI reading next to the creator's numbers, flags and proof."
- [Proof level **P2** → **Approve** (5–15 s).] "Proof level is a human decision. Approve attests on-chain and pins to IPFS."
- [**Attestation transaction ↗** → Blockscout, 3 s on screen, close.]

### 1:50–3:05 · Buyer purchases (T2 → View listing) · 75 s
- [**View listing**. Point at IV breakdown, price, *Payment goes to: creator 97.5% · platform 2.5%*.]
  "Price comes from the Impact Value. 100 editions."
- [**open** next to *Metadata (IPFS)*, 3 s, back.]
- [**Buy this impact** → MetaMask: approve tUSDG → confirm; redeem → confirm (2 popups, ~10 s).]
  "One transaction: the edition goes to the buyer, 97.5% straight to the creator's wallet, 2.5% to the platform."
- [**Bought ✓ · view tx** → Blockscout *Token transfers*: tUSDG to creator, tUSDG to platform, tRWI to buyer. Close.]

### 3:05–4:00 · Retire in the buyer's name (T4, My impact) · 55 s
- [Reload. Show *Impact Value owned*.] "The buyer now owns a share of this verified impact."
- [**Retire 1 edition** → MetaMask confirm (~5 s).]
  "Retiring burns the edition: the impact is claimed in the buyer's name, permanently, and cannot be sold again."
- [**Retirement transaction ↗** → Blockscout. **End here**, hand back to the slides.]

## Fallbacks

| If | Then | Cost |
|---|---|---|
| Submit spins > 20 s or errors | Say "the LLM provider is slow, here is the same report submitted this morning", go to T2 and approve the **backup** report. | 0 s |
| Approve spins > 20 s | Open the backup listing (already approved), continue with Buy. | +5 s |
| MetaMask popup does not appear | Click the MetaMask icon in the toolbar; pending requests are there. | +5 s |
| Buy tx pending > 20 s | Say "Arbitrum Sepolia is congested", go to T4 and retire the **backup holding**; open a past purchase tx from the listing's *token on explorer* link. | +10 s |
| Retire hangs | Open the backup holding's past retirement tx (link kept in the notes) and hand back. | 0 s |
| Site down or Zoom share fails | Play the backup recording (T6) and narrate over it. | 0 s |

## Backup recording

A full run of this script, recorded on Tue 24.11 after the second clean rehearsal: macOS **Cmd+Shift+5 → Record
Selected Portion** (the Chrome window, 1440×900), microphone off, saved as `~/Desktop/RB_SMU_demo_backup.mov`.
Narrate live over it if it is needed.

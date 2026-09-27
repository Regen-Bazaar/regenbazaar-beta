// Browser-wallet detection. The app connects through an injected provider (MetaMask, Rabby, Coinbase Wallet
// extension or a wallet's in-app browser); without one, connect() fails silently, so callers show a hint.
export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && typeof (window as { ethereum?: unknown }).ethereum !== "undefined";
}

export const NO_WALLET_HINT =
  "No wallet found. Install MetaMask (or another browser wallet), or on a phone open this site inside the MetaMask app's browser.";

export const WALLET_TIP = "On testnets use MetaMask or Rabby: some wallets (e.g. Zerion) fail to send testnet transactions.";

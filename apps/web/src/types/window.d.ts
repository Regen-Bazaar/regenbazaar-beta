interface Window {
  ethereum?: {
    isMetaMask?: boolean
    isBraveWallet?: boolean
    isCoinbaseWallet?: boolean
    isTrust?: boolean
    isTrustWallet?: boolean
    providers?: unknown[]
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (
      event: string,
      handler: (...args: unknown[]) => void
    ) => void
    removeAllListeners?: () => void
  }
}

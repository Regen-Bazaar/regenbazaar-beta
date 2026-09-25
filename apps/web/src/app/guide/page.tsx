import Link from "next/link";
import { NETWORK, otherDeployments } from "../../lib/networks";

// Plain-language walkthrough for first-time visitors (judges, testers). Faucet links differ per network.
const GAS_FAUCETS: Record<string, { name: string; url: string }[]> = {
  "robinhood-testnet": [
    { name: "Chainlink faucet (Robinhood testnet)", url: "https://faucets.chain.link/robinhood-testnet" },
    { name: "QuickNode faucet (Robinhood testnet)", url: "https://faucet.quicknode.com/robinhood/testnet" },
  ],
  "arbitrum-sepolia": [
    { name: "Chainlink faucet (Arbitrum Sepolia)", url: "https://faucets.chain.link/arbitrum-sepolia" },
    { name: "Alchemy faucet (Arbitrum Sepolia)", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
  ],
};

export default function Guide() {
  const cur = NETWORK.saleCurrency;
  const chain = NETWORK.chain.name;
  const explorer = NETWORK.chain.blockExplorers?.default.url ?? "";
  const faucets = GAS_FAUCETS[NETWORK.key] ?? [];
  const others = otherDeployments(NETWORK.key);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">How to try Regen Bazaar</h1>
      <p className="mt-2 text-paper/70">
        This is a beta on <b>{chain}</b>, a test network. Everything here uses test tokens with no monetary value.
        {others.length > 0 && (
          <>
            {" "}Also live on{" "}
            {others.map((o, i) => (
              <span key={o.url}>
                {i > 0 && ", "}
                <a href={`${o.url}/guide`} className="text-gold underline">{o.name}</a>
              </span>
            ))}
            .
          </>
        )}
      </p>

      <Section title="Just looking? (no wallet needed)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Browse the <Link href="/marketplace" className="text-gold underline">Marketplace</Link> and open any
            project to see its Impact Value breakdown and its on-chain attestation.
          </li>
          <li>
            Read how Impact Value is calculated on <Link href="/methodology" className="text-gold underline">Methodology</Link>.
          </li>
          <li>
            Check the verified smart contracts on the{" "}
            <a href={`${explorer}/address/${NETWORK.primarySale}`} target="_blank" rel="noopener noreferrer" className="text-gold underline">
              block explorer
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section title={`Fund an impact (about 5 minutes)`}>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <b>Get a wallet.</b> On a computer, install the{" "}
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-gold underline">MetaMask</a>{" "}
            extension. On a phone, install the MetaMask app and open this site inside the app&apos;s browser.
          </li>
          <li>
            <b>Get a little test ETH for fees</b> on {chain}:
            <ul className="mt-1 list-disc pl-5">
              {faucets.map((f) => (
                <li key={f.url}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-gold underline">{f.name}</a>
                </li>
              ))}
            </ul>
            <span className="text-paper/55">Some faucets ask you to sign in or hold a small mainnet balance.</span>
          </li>
          <li>
            <b>Get {cur.symbol}.</b>{" "}
            {cur.testMint ? (
              <>
                In the Marketplace, click <i>Get 100 test {cur.symbol}</i> under any listing. {cur.symbol} is a test
                stand-in for Paxos USDG with the same interface (the Paxos faucet is not dispensing on this network).
              </>
            ) : (
              <>
                Open the{" "}
                <a href="https://faucet.paxos.com/" target="_blank" rel="noopener noreferrer" className="text-gold underline">Paxos faucet</a>,
                choose <b>{chain}</b> and <b>USDG</b>, and paste your wallet address.
              </>
            )}
          </li>
          <li>
            <b>Fund.</b> In the <Link href="/marketplace" className="text-gold underline">Marketplace</Link>, click{" "}
            <i>Fund this impact</i>. Your wallet asks twice: first to allow {cur.symbol} to be spent (approve), then to
            confirm the purchase. If the network is missing in your wallet, it will offer to add it.
          </li>
          <li>
            <b>See what you funded</b> on <Link href="/portfolio" className="text-gold underline">My impact</Link>. You can
            retire an edition to permanently claim its share of the impact.
          </li>
        </ol>
      </Section>

      <Section title="Tokenize your impact (NGOs)">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Open <Link href="/tokenize" className="text-gold underline">Tokenize impact</Link> and describe what you did,
            with numbers: for example <i>&quot;planted 300 mangroves, collected 120 kg of waste, 25 volunteers&quot;</i>.
          </li>
          <li>
            Enter your organisation name and a <b>payout wallet</b>. Every sale pays this wallet directly in {cur.symbol}.
          </li>
          <li>
            Submit. A validator reviews it in <Link href="/verify" className="text-gold underline">Verify</Link>. In this
            demo anyone can act as the validator; in production this is a trusted reviewer.
          </li>
          <li>
            On approval the platform stores the report on IPFS and attests it on-chain (EAS). It then appears in the
            Marketplace with a price derived from its Impact Value.
          </li>
        </ol>
      </Section>

      <Section title="What is real and what is not">
        <ul className="list-disc space-y-1 pl-5">
          <li>Test networks and test tokens only. No real money moves.</li>
          <li>Impact Value is platform-assessed with published weights, not third-party certified.</li>
          <li>Reports submitted as the demo organisation are sample data.</li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-xl border border-gold/15 bg-ink-soft/30 p-5 text-sm leading-relaxed text-paper/85">
      <h2 className="mb-3 text-lg font-semibold text-paper">{title}</h2>
      {children}
    </section>
  );
}

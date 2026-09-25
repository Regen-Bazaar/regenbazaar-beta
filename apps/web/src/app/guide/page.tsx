import Link from "next/link";
import { NATIVE, enabledNetworks } from "../../lib/networks";
import { currentNetwork } from "../../lib/network-server";

// Plain-language walkthrough for first-time visitors (judges, testers). Faucet links differ per network.
const GAS_FAUCETS: Record<string, { name: string; url: string }[]> = {
  "robinhood-testnet": [
    { name: "Official Robinhood Chain faucet", url: "https://faucet.testnet.chain.robinhood.com" },
    { name: "QuickNode faucet (Robinhood testnet)", url: "https://faucet.quicknode.com/robinhood/testnet" },
  ],
  "arbitrum-sepolia": [
    { name: "HackQuest faucet (free with a HackQuest profile)", url: "https://www.hackquest.io/faucets" },
    { name: "Alchemy faucet (needs a small mainnet ETH balance)", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
  ],
  "celo-sepolia": [
    { name: "Official Celo Sepolia faucet", url: "https://faucet.celo.org/celo-sepolia" },
    { name: "Google Cloud faucet (Celo Sepolia)", url: "https://cloud.google.com/application/web3/faucet/celo/sepolia" },
  ],
};

export default async function Guide() {
  const NETWORK = await currentNetwork();
  const cur = NETWORK.saleCurrency;
  const native = cur.address === NATIVE;
  const gas = NETWORK.chain.nativeCurrency.symbol;
  const chain = NETWORK.chain.name;
  const explorer = NETWORK.chain.blockExplorers?.default.url ?? "";
  const faucets = GAS_FAUCETS[NETWORK.key] ?? [];
  const others = enabledNetworks().filter((n) => n.key !== NETWORK.key);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">How to try Regen Bazaar</h1>
      <p className="mt-2 text-paper/70">
        This is a beta on <b>{chain}</b>, a test network. Everything here uses test tokens with no monetary value.
        {others.length > 0 && (
          <>
            {" "}Switch networks in the header, or open this guide for{" "}
            {others.map((o, i) => (
              <span key={o.key}>
                {i > 0 && ", "}
                <a href={`/guide?network=${o.key}`} className="text-gold underline">{o.chain.name}</a>
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
            <b>Get a little test {gas}{native ? "" : " for fees"}</b> on {chain}:
            <ul className="mt-1 list-disc pl-5">
              {faucets.map((f) => (
                <li key={f.url}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-gold underline">{f.name}</a>
                </li>
              ))}
            </ul>
            <span className="text-paper/55">
              {native
                ? `On this network ${gas} pays both the fee and the purchase itself, so there is no separate token to get.`
                : `One claim is enough for many purchases: each costs a tiny fraction of a cent in test ${gas}.`}
            </span>
          </li>
          {!native && (
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
          )}
          <li>
            <b>Fund.</b> In the <Link href="/marketplace" className="text-gold underline">Marketplace</Link>, click{" "}
            <i>Fund this impact</i>.{" "}
            {native
              ? "Your wallet asks once, to confirm the purchase."
              : `Your wallet asks twice: first to allow ${cur.symbol} to be spent (approve), then to confirm the purchase.`} If the network is missing in your wallet, it will offer to add it.
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
            Open <Link href="/tokenize" className="text-gold underline">Tokenize impact</Link> and describe what you did in
            plain words, with numbers: for example{" "}
            <i>&quot;planted 300 mangroves, collected 120 kg of waste, 25 volunteers&quot;</i>. The Impact Value
            preview updates as you type.
          </li>
          <li>
            Enter your organisation name and a <b>payout wallet</b> (your MetaMask address). Every sale pays this wallet
            directly in {cur.symbol}. No wallet? Leave both empty and it is submitted as a demo.
          </li>
          <li>
            Press <i>Submit for verification</i>. Reports are checked automatically for inappropriate content, and you
            can send up to 5 per hour.
          </li>
          <li>
            The Regen Bazaar team reviews it. Once approved, it is recorded on-chain (an EAS attestation, with the report
            stored on IPFS), gets its own generated tRWI artwork, and appears in the{" "}
            <Link href="/marketplace" className="text-gold underline">Marketplace</Link> with a price based on its Impact
            Value. It is listed on <b>{chain}</b>, the network selected when you submit, and only there, so the same
            impact is never sold twice.
          </li>
        </ol>
      </Section>

      <Section title="Words you will see">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>tRWI</b>: tokenized real-world impact, a token that represents a verified piece of work.
          </li>
          <li>
            <b>Edition</b>: one share of an impact. Each impact is split into 100 editions, so you can fund a small part.
          </li>
          <li>
            <b>Impact Value</b>: a score from a published formula. It is a relative score for comparing reports, not a
            carbon or money amount. See <Link href="/methodology" className="text-gold underline">Methodology</Link>.
          </li>
          <li>
            <b>Retire</b>: permanently claim the impact of an edition you own. The edition is burned and cannot be
            resold.
          </li>
          {native ? (
            <li>
              <b>Confirm</b>: the one wallet pop-up when funding; it sends {cur.symbol} and makes the purchase.
            </li>
          ) : (
            <li>
              <b>Approve / Confirm</b>: the two wallet pop-ups when funding. The first lets the site use your{" "}
              {cur.symbol} for this purchase, the second makes the purchase.
            </li>
          )}
        </ul>
      </Section>

      <Section title="What is real and what is not">
        <ul className="list-disc space-y-1 pl-5">
          <li>Test networks and test tokens only. No real money moves.</li>
          <li>Impact Value is platform-assessed with published weights, not third-party certified.</li>
          <li>Reports submitted as the demo organisation, or marked &quot;(test data)&quot;, are sample data.</li>
          <li>Found a problem or something unclear? Tell us in our community chat.</li>
          <li>
            Where this is going: see the <Link href="/roadmap" className="text-gold underline">roadmap</Link>.
          </li>
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

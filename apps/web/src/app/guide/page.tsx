import Link from "next/link";
import { NATIVE, enabledNetworks } from "../../lib/networks";
import { currentNetwork } from "../../lib/network-server";

export const metadata = {
  title: "How to try Regen Bazaar",
  description: "A plain-language walkthrough: browse, fund an impact with test tokens, or tokenize your own report.",
};

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

const TOC = [
  { id: "look", label: "Just looking" },
  { id: "fund", label: "Fund an impact" },
  { id: "tokenize", label: "Tokenize your impact" },
  { id: "words", label: "Words you will see" },
  { id: "real", label: "What is real" },
];

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
    <main className="page-wrap py-10 md:py-14">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)] xl:gap-16">
      <nav aria-label="On this page" className="hidden lg:sticky lg:top-24 lg:block">
        <p className="label-mono mb-3">On this page</p>
        <ol className="space-y-2 border-l border-line">
          {TOC.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="-ml-px block border-l-2 border-transparent pl-4 text-muted hover:border-accent hover:text-fg">
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0 max-w-[76ch]">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">How to try Regen Bazaar</h1>
      <p className="mt-3 text-lg text-muted">
        This is a beta on <b>{chain}</b>, a test network. Everything here uses test tokens with no monetary value.
        {others.length > 0 && (
          <>
            {" "}Switch networks in the header, or open this guide for{" "}
            {others.map((o, i) => (
              <span key={o.key}>
                {i > 0 && ", "}
                <a href={`/guide?network=${o.key}`} className="link">{o.chain.name}</a>
              </span>
            ))}
            .
          </>
        )}
      </p>

      <Section id="look" title="Just looking? (no wallet needed)">
        <ul className="list-disc space-y-2 pl-5 marker:text-accent">
          <li>
            Browse the <Link href="/marketplace" className="link">Marketplace</Link> and open any
            project to see its Impact Value breakdown and its on-chain attestation.
          </li>
          <li>
            Read how Impact Value is calculated on <Link href="/methodology" className="link">Methodology</Link>.
          </li>
          <li>
            Check the verified smart contracts on the{" "}
            <a href={`${explorer}/address/${NETWORK.primarySale}`} target="_blank" rel="noopener noreferrer" className="link">
              block explorer
            </a>
            .
          </li>
        </ul>
      </Section>

      <Section id="fund" title={`Fund an impact (about 5 minutes)`}>
        <ol className="list-decimal space-y-4 pl-5 marker:font-semibold marker:text-accent">
          <li>
            <b>Get a wallet.</b> On a computer, install the{" "}
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="link">MetaMask</a>{" "}
            extension (Rabby works too). On a phone, install the MetaMask app and open this site inside the
            app&apos;s browser, or choose <b>WalletConnect</b> under Connect wallet and scan the QR code. The site
            asks your wallet to switch to {chain} and adds the network if it is missing. Some wallets (Zerion, for
            example) fail to send testnet transactions, so use MetaMask or Rabby here.
          </li>
          <li>
            <b>Get a little test {gas}{native ? "" : " for fees"}</b> on {chain}:
            <ul className="mt-1 list-disc pl-5">
              {faucets.map((f) => (
                <li key={f.url}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="link">{f.name}</a>
                </li>
              ))}
            </ul>
            <span className="mt-1 block text-muted">
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
                <a href="https://faucet.paxos.com/" target="_blank" rel="noopener noreferrer" className="link">Paxos faucet</a>,
                choose <b>{chain}</b> and <b>USDG</b>, and paste your wallet address.
              </>
            )}
          </li>
          )}
          <li>
            <b>Fund.</b> In the <Link href="/marketplace" className="link">Marketplace</Link>, click{" "}
            <i>Fund this impact</i>.{" "}
            {native
              ? "Your wallet asks once, to confirm the purchase."
              : `Your wallet asks twice: first to allow ${cur.symbol} to be spent (approve), then to confirm the purchase.`} If the network is missing in your wallet, it will offer to add it.
          </li>
          <li>
            <b>See what you funded</b> on <Link href="/portfolio" className="link">My impact</Link>. You can
            retire an edition to permanently claim its share of the impact.
          </li>
        </ol>
      </Section>

      <Section id="tokenize" title="Tokenize your impact (NGOs)">
        <ol className="list-decimal space-y-4 pl-5 marker:font-semibold marker:text-accent">
          <li>
            Open <Link href="/tokenize" className="link">Tokenize impact</Link> and describe what you did in
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
            <Link href="/marketplace" className="link">Marketplace</Link> with a price based on its Impact
            Value. It is listed on <b>{chain}</b>, the network selected when you submit, and only there, so the same
            impact is never sold twice.
          </li>
        </ol>
      </Section>

      <Section id="words" title="Words you will see">
        <ul className="list-disc space-y-2 pl-5 marker:text-accent">
          <li>
            <b>tRWI</b>: tokenized real-world impact, a token that represents a verified piece of work.
          </li>
          <li>
            <b>Edition</b>: one share of an impact. Each impact is split into 100 editions, so you can fund a small part.
          </li>
          <li>
            <b>Impact Value</b>: a score from a published formula. It is a relative score for comparing reports, not a
            carbon or money amount. See <Link href="/methodology" className="link">Methodology</Link>.
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

      <Section id="real" title="What is real and what is not">
        <ul className="list-disc space-y-2 pl-5 marker:text-accent">
          <li>Test networks and test tokens only. No real money moves.</li>
          <li>Impact Value is platform-assessed with published weights, not third-party certified.</li>
          <li>Reports submitted as the demo organisation, or marked &quot;(test data)&quot;, are sample data.</li>
          <li>Found a problem or something unclear? Tell us in our community chat.</li>
          <li>
            Where this is going: see the <Link href="/roadmap" className="link">roadmap</Link>.
          </li>
        </ul>
      </Section>
      </div>
      </div>
    </main>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card mt-8 scroll-mt-24 p-6 leading-relaxed md:p-8">
      <h2 className="mb-4 text-[1.75rem]">{title}</h2>
      {children}
    </section>
  );
}

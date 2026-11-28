// The events the purchase record job reads, and the one place that turns a raw log into a row.
// Pure: no database and no network here.
import { decodeEventLog, toEventSelector, type AbiEvent } from "viem";
import type { Hex, RecordedChain, RecordedContract } from "./contracts";

const ev = <const T extends AbiEvent>(e: T) => e;

// ERC-1155 (both tRWI versions): every mint, transfer and burn of editions.
const TransferSingle = ev({
  type: "event",
  name: "TransferSingle",
  inputs: [
    { name: "operator", type: "address", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "id", type: "uint256", indexed: false },
    { name: "value", type: "uint256", indexed: false },
  ],
});
const TransferBatch = ev({
  type: "event",
  name: "TransferBatch",
  inputs: [
    { name: "operator", type: "address", indexed: true },
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "ids", type: "uint256[]", indexed: false },
    { name: "values", type: "uint256[]", indexed: false },
  ],
});
// TRWI (today's contract): retire.
const ImpactRetired = ev({
  type: "event",
  name: "ImpactRetired",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "holder", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "ivRetired", type: "uint256", indexed: false },
  ],
});
// TRWIV4 (revision 4): retire writes a contribution statement.
const ContributionStatement = ev({
  type: "event",
  name: "ContributionStatement",
  inputs: [
    { name: "statementId", type: "uint256", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "holder", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "impactValue", type: "uint256", indexed: false },
    { name: "inNameOf", type: "string", indexed: false },
  ],
});
// RegenPrimarySale, first and second version.
const SoldV2 = ev({
  type: "event",
  name: "Sold",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "buyer", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "total", type: "uint256", indexed: false },
    { name: "currency", type: "address", indexed: false },
  ],
});
// RegenPrimarySaleV3 (revision 4).
const SoldV3 = ev({
  type: "event",
  name: "Sold",
  inputs: [
    { name: "tokenId", type: "uint256", indexed: true },
    { name: "payer", type: "address", indexed: true },
    { name: "recipient", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "currency", type: "address", indexed: false },
    {
      name: "payout",
      type: "tuple",
      indexed: false,
      components: [
        { name: "total", type: "uint256" },
        { name: "creatorPaid", type: "uint256" },
        { name: "platformPaid", type: "uint256" },
        { name: "partnerPaid", type: "uint256" },
        { name: "beneficiary", type: "address" },
        { name: "partner", type: "address" },
      ],
    },
  ],
});

const TOKEN_EVENTS = [TransferSingle, TransferBatch, ImpactRetired, ContributionStatement] as const;
const SALE_EVENTS = [SoldV2, SoldV3] as const;
export const RECORD_EVENTS = [...TOKEN_EVENTS, ...SALE_EVENTS] as const;
export const RECORD_TOPICS: Hex[] = RECORD_EVENTS.map((e) => toEventSelector(e));

export interface RawLog {
  address: string;
  topics: readonly string[];
  data: string;
  blockNumber: bigint | number;
  transactionHash: string;
  logIndex: number;
}

export type EventKind = "bought" | "transferred" | "retired";

/** One row of edition_events, before the block time is known. */
export interface DecodedEvent {
  chainId: number;
  contract: string;
  tokenContract: string;
  kind: EventKind;
  tokenId: string;
  amount: string;
  wallet: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  payer: string | null;
  currency: string | null;
  totalPaid: string | null;
  statementId: string | null;
  inNameOf: string | null;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  batchIndex: number;
}

const lc = (a: string) => a.toLowerCase();

/**
 * Turns raw logs into rows. A log from a contract the record does not know, an event the contract's role
 * does not emit, or a log that does not decode is skipped: it can never become a purchase.
 */
export function decodeLogs(chain: Pick<RecordedChain, "chainId" | "contracts">, logs: readonly RawLog[]): DecodedEvent[] {
  const byAddress = new Map<string, RecordedContract>(chain.contracts.map((c) => [c.address, c]));
  const out: DecodedEvent[] = [];
  for (const log of logs) {
    const contract = byAddress.get(lc(log.address));
    if (!contract || !log.topics.length) continue;
    const base = {
      chainId: chain.chainId,
      contract: contract.address,
      tokenContract: contract.token,
      blockNumber: Number(log.blockNumber),
      txHash: lc(log.transactionHash),
      logIndex: log.logIndex,
      batchIndex: 0,
      wallet: null,
      fromAddress: null,
      toAddress: null,
      payer: null,
      currency: null,
      totalPaid: null,
      statementId: null,
      inNameOf: null,
    } satisfies Partial<DecodedEvent>;
    const topics = log.topics as [Hex, ...Hex[]];
    const data = log.data as Hex;
    try {
      if (contract.role === "token") {
        const d = decodeEventLog({ abi: TOKEN_EVENTS, topics, data, strict: true });
        if (d.eventName === "TransferSingle") {
          if (d.args.value === 0n) continue;
          out.push({ ...base, kind: "transferred", tokenId: d.args.id.toString(), amount: d.args.value.toString(), fromAddress: lc(d.args.from), toAddress: lc(d.args.to) });
        } else if (d.eventName === "TransferBatch") {
          if (d.args.ids.length !== d.args.values.length) continue;
          d.args.ids.forEach((id, i) => {
            if (d.args.values[i] === 0n) return;
            out.push({ ...base, batchIndex: i, kind: "transferred", tokenId: id.toString(), amount: d.args.values[i].toString(), fromAddress: lc(d.args.from), toAddress: lc(d.args.to) });
          });
        } else if (d.eventName === "ImpactRetired") {
          out.push({ ...base, kind: "retired", tokenId: d.args.tokenId.toString(), amount: d.args.amount.toString(), wallet: lc(d.args.holder) });
        } else {
          out.push({ ...base, kind: "retired", tokenId: d.args.tokenId.toString(), amount: d.args.amount.toString(), wallet: lc(d.args.holder), statementId: d.args.statementId.toString(), inNameOf: d.args.inNameOf || null });
        }
      } else {
        const d = decodeEventLog({ abi: SALE_EVENTS, topics, data, strict: true });
        if ("buyer" in d.args) {
          out.push({ ...base, kind: "bought", tokenId: d.args.tokenId.toString(), amount: d.args.amount.toString(), wallet: lc(d.args.buyer), payer: lc(d.args.buyer), currency: lc(d.args.currency), totalPaid: d.args.total.toString() });
        } else {
          out.push({ ...base, kind: "bought", tokenId: d.args.tokenId.toString(), amount: d.args.amount.toString(), wallet: lc(d.args.recipient), payer: lc(d.args.payer), currency: lc(d.args.currency), totalPaid: d.args.payout.total.toString() });
        }
      }
    } catch {
      continue;
    }
  }
  return out;
}

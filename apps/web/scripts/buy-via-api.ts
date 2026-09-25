// Buy editions through the LIVE app: fetch a platform-signed voucher from APP_URL, approve, redeem.
//   LID=<listing uuid> PK=<buyer key> NEXT_PUBLIC_NETWORK=arbitrum-sepolia node --import tsx scripts/buy-via-api.ts
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getNetwork } from "../src/lib/networks.ts";
const NETWORK = getNetwork(process.env.NEXT_PUBLIC_NETWORK);
import { erc20Abi, redeemAbi } from "../src/lib/chain.ts";
const res = await fetch(`${process.env.APP_URL ?? "https://app.regenbazaar.com"}/api/listings/${process.env.LID}/voucher`);
const j = await res.json();
if (!res.ok) throw new Error(JSON.stringify(j));
const v = j.voucher;
const voucher = { ...v, tokenId: BigInt(v.tokenId), totalIV: BigInt(v.totalIV), maxEditions: BigInt(v.maxEditions), pricePerEdition: BigInt(v.pricePerEdition), royaltyBps: BigInt(v.royaltyBps), feeBps: BigInt(v.feeBps), nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) };
console.log("voucher from app:", j.chainId, j.contract, "currency", v.currency, "price", v.pricePerEdition);
const pk = process.env.PK!; const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
const chain = NETWORK.chain; const wallet = createWalletClient({ account, chain, transport: http() }); const pub = createPublicClient({ chain, transport: http() });
const amount = 2n; const total = voucher.pricePerEdition * amount;
const a = await wallet.writeContract({ address: v.currency, abi: erc20Abi, functionName: "approve", args: [j.contract, total] });
await pub.waitForTransactionReceipt({ hash: a });
const h = await wallet.writeContract({ address: j.contract, abi: redeemAbi, functionName: "redeem", args: [voucher, amount, j.signature] });
const r = await pub.waitForTransactionReceipt({ hash: h });
console.log("approve", a); console.log("redeem", h, r.status);

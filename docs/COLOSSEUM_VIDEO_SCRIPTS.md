# Colosseum · video scripts

> Для Paul: решение 27.09: одна запись с лицом и экраном идёт в оба поля (pitch и demo):
> https://www.loom.com/share/a69dc479cec34ad3a5499168db8b7d77. Запись **4:54**, лимит каждого видео 3:00.
> Если урезать: оставить куски по таблице демо ниже, текст питча как опора для голоса.

---

## 1. Pitch video (лицо в кадре, 2:30–2:50)

| Time | Кадр | Текст |
|---|---|---|
| 0:00–0:20 | Лицо | "I'm Paul Burg, based in Da Nang. For three years I worked with community groups in Thailand: beach cleanups, mangrove restoration. They do real, measurable good, and almost none of it can be funded as something a funder can hold and check." |
| 0:20–0:45 | Лицо | "Carbon registries cost more to certify than a small project raises. Donations give you a receipt, not an asset, and no proof of what your money did. So small impact stays unfunded." |
| 0:45–1:15 | Лицо, затем экран marketplace | "Regen Bazaar turns verified impact into tRWI, tokenized real-world impact. An organisation describes its work in plain words. AI extracts the numbers, a published formula scores it, a person approves, and the claim is attested on-chain. Funders buy editions in USDG, and the organisation is paid in the same transaction." |
| 1:15–1:40 | Лицо | "Why on-chain: the funder gets an asset they can hold, transfer or retire, and anyone can check where it came from. And it is cheap enough on Arbitrum and Robinhood Chain to fund impact in dollars, not thousands." |
| 1:40–2:05 | Лицо | "Judges will ask about the weights, so here's the honest answer. v0.1 are starting weights. The audit is done and the v0.2 plan is ready: physical units from IPCC, EPA and IFI coefficients, evidence levels, and scores per impact domain. Every score already records its version." |
| 2:05–2:30 | Лицо | "Who pays: people who want proof, companies with CSR budgets that need auditable small tickets, and AI agents through our open API. We earn a 2.5% fee on sales. The first organisations are the ones we already ran collections with, Clean Phangan and EcoThailand." |
| 2:30–2:45 | Лицо | "It's live on testnets today, open source, MIT. Next: v0.2 methodology, audit, mainnet. Regen Bazaar: fund real impact, and check it." |

Правила: не называть цифры Clean Phangan и EcoThailand; не говорить «certified», «carbon credit», «mainnet product».

---

## 2. Product demo video (экран, до 3:00)

Сеть: Robinhood Chain testnet (настоящий Paxos USDG). Перед записью: кошелёк с test ETH и USDG
(faucet Paxos), подготовленный текст отчёта, вход ревьюера на `/verify`.

| Time | Экран | Текст |
|---|---|---|
| 0:00–0:15 | Home, переключатель сетей | "Regen Bazaar on Robinhood Chain testnet. The same app runs on Arbitrum Sepolia and Celo Sepolia; each report is listed on one network only." |
| 0:15–0:55 | `/tokenize`: вставить текст, извлечённые действия, Impact Value | "An organisation describes its work in plain text. The model only extracts actions and quantities; a deterministic formula computes Impact Value, with a per-factor breakdown and the methodology version." |
| 0:55–1:20 | `/verify`: доказательства, Approve | "A validator reviews the evidence and approves. Metadata goes to IPFS and the claim is attested with EAS." |
| 1:20–1:35 | `/marketplace`: фильтр по SDG, карточка | "Funders browse by SDG and domain. Price comes from Impact Value, in USDG." |
| 1:35–2:15 | Fund this impact → approve USDG → confirm | "One transaction: the contract checks the signed voucher and the attestation, pays 97.5% to the organisation, and mints tRWI." |
| 2:15–2:35 | Explorer: транзакция, split, verified contract | "Here it is on the explorer: USDG split to the NGO and the fee, the token minted, source-verified contracts." |
| 2:35–2:50 | `/portfolio` (My impact): holdings, Retire | "The funder sees exactly what they funded, and can retire editions to claim the impact." |
| 2:50–3:00 | `/roadmap` или лого | "Open source. Next: methodology v0.2 with physical units. Regen Bazaar." |

### Если обрезать текущую запись (4:54 → до 3:00)
Я не вижу содержимое видео, только автоописание. Оставить куски в порядке таблицы выше и вырезать: вступление о
проекте длиннее 15 с, ожидание подтверждения транзакций, прокрутки без действия, рассказ про историю с 2025
(он есть в питче и в описании проекта). Если после обрезки выходит больше 3:00 или теряется шаг покупки, проще
перезаписать.

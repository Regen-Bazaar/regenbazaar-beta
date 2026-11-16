# SMU final · Q&A prep (5 minutes)

> Для Paul. Ответ: 2–3 предложения, ~20 секунд. Сначала прямой ответ, потом одна деталь. Если не знаешь: «Good
> question. We have not solved that yet; here is how we plan to approach it.» Ничего не обещать сверх roadmap.
> Под каждым ответом короткая русская подсказка.

## Web3 and tokens

**1. Why does this need a blockchain? A database would do.**
A database would work if buyers trusted us. On-chain, anyone can check who was paid, how much and for which
verified claim, without asking us. And stablecoin settlement pays a creator anywhere, in the same transaction.
> RU: проверяемость без доверия к нам + выплата в любую страну в той же транзакции.

**2. What is your tokenomics? Is there a token?**
Buyers pay in stablecoins; there is no token to buy and nothing to speculate on. Each edition is a record of a
verified result, not an investment. An earlier plan had a utility token for validator rewards; it exists only on
test networks and the reward model is not designed yet.
> RU: оплата в стейблкоинах, токен не нужен. REBAZ только на тестнетах, модель вознаграждений не спроектирована,
> ничего не обещать.

**3. Why EVM and several chains? Why not one?**
We go where creators and buyers already are: Celo has many impact projects, Arbitrum has the users and
stablecoin rails. But one report is listed on exactly one network, so the same work is never sold twice across chains.
> RU: идём туда, где люди; но один отчёт = одна сеть.

## Trust and verification

**4. Validators are your own team. Why should a buyer trust that?**
Today, they should trust the evidence, not us: every listing shows its proof level, the evidence and the
attestation. Moving verification to a community of validators with a public track record is on our roadmap, with
the core team double-checking new validators first.
> RU: сейчас валидирует команда, честно; доказательства публичны; сообщество валидаторов в roadmap.

**5. How do you stop fake reports or double counting?**
Four layers: a validator sets a proof level and P0 is never listed; proof links are saved as dated snapshots; one
report goes on exactly one network; and partner imports, like DeCleanup, are checked so one cleanup can be in only
one listing. Revocation of a false claim and checks against other registries are next on the roadmap.
> RU: уровни доказательств, снапшоты ссылок, одна сеть, проверка импорта; отзыв и сверка с реестрами в roadmap.

**6. An AI reads the reports. What if it makes things up?**
The AI only extracts facts from the creator's own text, and the creator can correct them. It never sets the
score: a published, versioned formula does that, and a human validator approves every listing.
> RU: AI только извлекает факты, считает формула, одобряет человек.

**7. What is Impact Value, and can I compare a beach cleanup with mangroves?**
It is our own relative index, version 0.2, with a public card for every weight that says if it is sourced,
derived or still an assumption. It is not a certification or a carbon credit, and we do not claim that different
categories are comparable. Experts still need to calibrate many weights.
> RU: свой индекс, карточки весов публичны, не сертификат, категории не сравниваем.

## Market and business

**8. Who will actually buy? Is there demand?**
Honest answer: demand is not proven yet; we have no production sales. We see three buyer groups: people who want
proof of what they paid for, companies that need small, traceable impact purchases for their reports, and AI
agents through a public catalogue at /api/impact. Our next step is to test this with real creators and buyers.
> RU: спрос не доказан, честно; три группы покупателей; дальше проверяем на реальных.

**9. How do you make money? Is 2.5% enough?**
A 2.5% fee on each primary sale, paid in the same transaction; partners like DeCleanup earn 2.5% the same way. It
is enough to run a lean platform at scale, not at small volume, so grants cover the build phase. We keep the fee
low on purpose, so almost all the money reaches the creator.
> RU: 2,5% с продажи; при малом объёме не окупится, этап разработки на грантах; низкая комиссия намеренно.

**10. How are you different from carbon registries like Verra or Gold Standard?**
They certify large projects, and that costs more than a small group earns. We serve the long tail: a beach
cleanup, a mangrove planting, with proof levels instead of full certification, and no fee before the first
sale. We also do not sell carbon credits or offsets. For buyers who need it, an accredited verification tier is
on the roadmap.
> RU: реестры для крупных и дорогие; мы для мелких, без платы вперёд, не продаём офсеты.

**11. How are you different from Hypercerts?**
Hypercerts are a standard for recording who did what work. Regen Bazaar is a marketplace on top of a verified
claim: a proof level, a price, and payment to the creator in one transaction. They are complementary: for partner
imports we plan to link the matching hypercert record.
> RU: Hypercerts фиксируют заявку на импакт; мы добавляем проверку, цену и оплату; дополняем друг друга.

**12. Regulation: green claims, money transfers, foreign funds?**
We never say offset or carbon neutral, in line with the EU rules on green claims. Before full mainnet we plan a
legal review, terms where creators confirm they may receive foreign payments, wallet sanctions screening, and
only regulated stablecoins native to each network.
> RU: не используем «offset», юр. проверка, условия, санкционный скрининг, регулируемые стейблкоины до mainnet.

## Team and feasibility

**13. You are a solo founder. Can you deliver?**
Everything you saw was built and shipped by me, with AI coding tools, and the code is open and tested: 75 Foundry
tests, source-verified contracts. I have built in regenerative finance since 2023 and spoke at Devcon 7 about
impact marketplaces. For the next phase I want a domain expert for the methodology and validators from partner
organisations.
> RU: всё сделано и выложено мной, код открыт и протестирован; дальше нужны эксперт и валидаторы-партнёры.

**14. Are you on mainnet? Who holds the keys?**
Not for real use: everything you saw runs on test networks, and admin roles sit on one key today. Before mainnet we
plan an external audit, a multisig with a timelock and a legal review, as stated on our roadmap.
> RU: для реального использования mainnet нет, всё на тестнетах; ключ сейчас один; аудит, мультисиг и юр. проверка
> до mainnet. Если спросят про Arc (заявка на Arc Microgrants публична): «In October we ran a small sale-layer
> experiment on Arc mainnet for a grant application. It is closed now; the contracts are still in a test phase.»

**15. If you win, what do you do with the prize and incubation grant?**
> ВОПРОС К PAUL: ответ твой (деньги). Черновик: «Onboarding the first real creators in Southeast Asia, wallet-free
> login, and an expert review of the methodology.»

## Facts to have at hand (all public)

- App: app.regenbazaar.com · Methodology: app.regenbazaar.com/methodology · Roadmap: app.regenbazaar.com/roadmap
- Code: github.com/Regen-Bazaar/regenbazaar-beta (75 Foundry tests incl. fuzz)
- Split: 97.5 / 2.5, or 95 / 2.5 / 2.5 with a partner; partner live on all 3 testnets since 06.10.2026
- Price: IV × rate ($1 per point, provisional) × proof factor × cost coefficient 1.0–1.5

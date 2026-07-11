# Software Requirements Specification — darknote Premium Notes

**Version:** 1.0 · **Date:** 11 July 2026 · **Status:** governs development of the assessed increment; changes land via pull request so requirement evolution is diffable in version control.

---

## 1. Introduction

### 1.1 Context and prior work

**darknote** (product name *DarkNote*) is an existing, author-built application: it sends end-to-end encrypted notes to any Solana wallet. A note is encrypted **in the sender's browser** with NaCl `box` (X25519 key agreement + XSalsa20-Poly1305 AEAD); the recipient's encryption keypair is *derived deterministically from a wallet signature*, so only the wallet owner can decrypt and **the server stores nothing but ciphertext, a nonce, and an ephemeral public key**. Notes self-destruct after reading.

darknote is **pre-existing personal work** and is treated throughout this project as the project baseline / prior context — not as assessed output. This SRS and every commit in this repository from the baseline tag onward concern a **new feature built within the assessment window**. This mirrors the module's sanctioned "continue your own project / add a feature" shape.

### 1.2 Problem statement (motivating the new feature)

darknote today grants its most powerful capabilities to anyone, for free and unmetered: the note-creation API accepts multi-read notes (`maxReads` up to 1000), payloads up to 100 KB, and long-lived retention with no cost or friction. This is two problems at once:

1. **Abuse surface.** Unmetered multi-read, large-payload, long-retention notes are an attractive vector for spam and storage abuse — there is no cost to deter it.
2. **No sustainable model.** A privacy tool cannot monetise through the usual levers — ads and accounts both require harvesting user data, which would destroy the very proposition (*"no accounts, emails, or phone numbers; even we can't read them"*).

The feature resolves both by introducing a **premium tier unlocked with a per-note micropayment settled on-chain via x402**. Free notes keep working exactly as before. Premium capabilities (multi-read, guaranteed extended retention, larger payloads) require a small, verified USDC payment — no account, no KYC, no ads, no tracking. Payment adds friction precisely where abuse lives, and creates revenue without compromising the privacy model.

### 1.3 Glossary

| Term | Meaning |
|---|---|
| Note | An encrypted message stored as ciphertext, addressed to a Solana wallet |
| End-to-end / "zero-access" | Notes are encrypted client-side with NaCl `crypto_box` (X25519 + XSalsa20-Poly1305); the server stores only ciphertext, nonce and ephemeral public key and holds no key to decrypt. "Zero-knowledge" here means the server has zero knowledge of plaintext — **not** zero-knowledge *proofs*. |
| Self-destruct | A note deleted after its read allowance is exhausted |
| Free tier | Single-read, standard-size, standard-retention note — no payment |
| Premium tier | Multi-read, larger-payload, and/or guaranteed-retention note — requires payment |
| x402 | Open HTTP-402 payment protocol (Coinbase, 2025): a server answers `402` with machine-readable terms; the client pays on-chain and retries |
| Facilitator | Third-party service that verifies and settles an x402 payment on-chain |
| Nonce | A single-use token binding a payment to one premium unlock (replay guard) |

---

## 2. Scope

### 2.1 In scope (assessed increment)

1. **Tier classification** — decide, from a note-creation request, whether it is *free* or *premium*.
2. **x402 unlock on note creation** — a premium request with no verified payment returns `402` with x402 terms; with a facilitator-verified payment, the premium note is created.
3. **Replay-safe unlock** — one settlement unlocks exactly one premium note.
4. **Server-side tier enforcement** — free-tier limits (read count, payload size, retention) and premium ceilings are enforced on the server regardless of client-supplied values.
5. **Guaranteed retention** — premium notes are exempt from the periodic free-note cleanup.
6. **x402 discovery / pricing endpoint** and a `Facilitator` abstraction with a mock for tests and the demo.
7. **Automated test suite** with requirements traceability ([TRACEABILITY.md](TRACEABILITY.md)).

### 2.2 Out of scope

- The base darknote application: its encryption scheme, wallet key derivation, storage, reader UI (pre-existing context, §1.1).
- Any change to the cryptography or the end-to-end confidentiality property.
- Custody of funds; the existing SOL "gift" flow (a separate third-party integration).
- Accounts, KYC, ads, or any personal-data collection.
- Fiat payment rails.

### 2.3 Communication channels

| Channel | Used for | Audience |
|---|---|---|
| Supervisor meetings / email | Progress, formative feedback on drafts | Supervisor |
| GitHub repository (commits, branches, PRs, Actions CI) | Change control, development evidence, review trail | Supervisor, markers, author |
| In-app pricing / x402 discovery response | The machine-readable premium terms a client integrates against | Sending clients |
| Project report + 15-minute video | Summative communication of artefact and process | Markers |

---

## 3. User scenarios

**S1 — The privacy-first sender (free).** Kai sends a one-time secret to a collaborator's wallet. He wants exactly what darknote already gives: encrypt in-browser, single read, self-destruct, no account, no cost. The new feature must not add any friction to this path.

**S2 — The sender who needs it to persist (premium).** Mara sends recovery instructions her teammate must read on several devices over the next month. She needs a note that survives multiple reads and is guaranteed not to be swept by cleanup. She is willing to pay a few cents — but refuses to create an account or hand over card details for a privacy product.

**S3 — The abuse-conscious operator (author).** The operator wants unmetered multi-read/large/long-lived notes to stop being free, because "free and unlimited" is the spam and storage-abuse vector — while keeping ordinary private notes free and frictionless.

**S4 — The machine sender (stretch).** An application wants to send encrypted notifications to its users' wallets programmatically and pay per message without a contract or signup — a natural fit for x402's account-less, machine-payable model.

Scenarios drive the use cases (§4); every functional requirement (§5) traces to a use case.

---

## 4. Use cases

UML use-case diagram: [diagrams/use-cases.puml](diagrams/use-cases.puml). Premium-unlock interaction: [diagrams/x402-sequence.puml](diagrams/x402-sequence.puml).

**Actors.** *Sender* (free and premium, S1–S2), *Operator* (policy, S3), *Machine sender* (S4, stretch). Supporting external systems: *Browser wallet*, *x402 facilitator*.

| ID | Name | Actor | Summary | From |
|---|---|---|---|---|
| UC1 | Send free note | Sender | Create a single-read, standard note with no payment (existing behaviour, now bounded by free-tier limits) | S1 |
| UC2 | Discover premium terms | Sender | Request premium capability without payment; receive `402` with machine-readable price/terms | S2 |
| UC3 | Unlock premium note (x402) | Sender | Pay via x402; on verified settlement, the premium note is created | S2 |
| UC4 | Enforce tier limits | Operator | Server bounds read count, payload size, retention per tier regardless of client input | S3 |
| UC5 | Guaranteed retention | Sender | A premium note is exempt from free-note cleanup | S2 |
| UC6 | Read note | Recipient | Decrypt in-browser; free notes self-destruct (existing behaviour, context) | S1 |
| UC7 | Programmatic metered send | Machine sender | Send notes via API, paying per note with x402 *(Could)* | S4 |

**UC3 main flow (premium unlock):**
1. Sender composes a note and selects a premium option (e.g. 5 reads).
2. Client `POST`s the note; server classifies it premium and, finding no payment, returns `402` with x402 terms and a nonce.
3. Sender's wallet signs a payment authorisation; client retries with the payment header.
4. Server verifies settlement with the facilitator; on success it atomically redeems the nonce (one unlock per settlement) and creates the premium note.
5. Server returns the note id.

**Alternate/error flows:** payment unverified (4a: `402` retained, no note created); replayed settlement (4b: nonce already redeemed → rejected, no second note); premium values exceed premium ceilings (client tamper) (3a: `400`, bounded); free request over free limits (1a: `402` — it is really a premium request).

---

## 5. Functional requirements

Priorities: **M**ust / **S**hould / **C**ould. Each traces to use case(s); verification in [TRACEABILITY.md](TRACEABILITY.md).

| ID | Pri | UC | Requirement |
|---|---|---|---|
| FR1 | M | UC1, UC4 | The server shall classify a note-creation request as *free* or *premium* from its requested capabilities (read count, payload size, retention). |
| FR2 | M | UC1 | A free-tier request within free limits shall be created with no payment and no added latency versus the pre-existing flow. |
| FR3 | M | UC2 | A premium request without a verified payment shall return `402` with machine-readable x402 terms (amount, asset, network, recipient, nonce). |
| FR4 | M | UC3 | A premium request bearing a payment shall be honoured only after the facilitator verifies settlement; an unverified payment shall create nothing. |
| FR5 | M | UC3 | Each settlement shall unlock exactly one premium note: a replayed or duplicate settlement shall create no second note (nonce redeemed atomically). |
| FR6 | M | UC4 | The server shall enforce tier ceilings (max read count, max payload size, retention) regardless of client-supplied values; requests beyond premium ceilings shall be rejected. |
| FR7 | M | UC5 | Premium notes shall be exempt from the periodic free-note cleanup so their retention is guaranteed. |
| FR8 | S | UC2 | The system shall publish premium pricing via a discovery endpoint and an x402 challenge response. |
| FR9 | M | all | All failure paths shall return user-readable messages that never leak internal details (facilitator internals, stack traces, env var names). |
| FR10 | S | UC3 | Premium price shall be derived from the specific capabilities requested (per-feature pricing). |
| FR11 | C | UC7 | The system shall expose a metered API to send notes programmatically, paid per note via x402. |

---

## 6. Non-functional requirements (ISO/IEC 9126 categories)

**Functionality (incl. security)**
- NFR1 — *Payment integrity:* premium capability shall be granted only after facilitator-verified settlement; the unlock shall be replay-resistant (FR5). Verified by tests covering valid, invalid, duplicate, and concurrent payments.
- NFR2 — *Tamper resistance:* tier limits shall hold against a hostile client that inflates `maxReads`, payload size, or retention in the request body (FR6).
- NFR3 — *End-to-end confidentiality preserved:* the feature shall not weaken darknote's property that the server holds no key and cannot decrypt a note; payment metadata shall not be linkable to plaintext (there is none server-side).

**Reliability**
- NFR4 — Nonce redemption shall be atomic and consistent under concurrent requests; the same settlement shall never unlock two notes.

**Usability**
- NFR5 — The `402` terms shall be self-describing enough to complete payment from the response alone (no out-of-band docs).

**Efficiency**
- NFR6 — Payment occurs only on the premium path; the free-note path shall carry no payment round-trip and no measurable added latency. Reported in Results.

**Portability**
- NFR7 — The feature shall run within the existing Next.js app on current Node LTS, storing state in the existing SQLite database.

**Maintainability**
- NFR8 — Payment/settlement shall sit behind a `Facilitator` interface so a mock (tests/demo) or a real facilitator swaps with no business-logic change.
- NFR9 — New modules (classification, enforcement, x402, settlement store) shall hold ≥ 80% line coverage.

---

## 7. Technology selection and risks

Weighted Pugh matrices appear in the report (Research chapter); selections summarised here.

| Decision | Options considered | Selected | Key rationale |
|---|---|---|---|
| **Payment mechanism** | **x402 · verify a raw on-chain SOL transfer · Stripe/cards · L402 (Lightning)** | **x402** | Account-less and machine-payable — matches darknote's no-account/no-PII ethos; on-chain USDC settlement; standard terms a client can parse. Stripe needs accounts + KYC (breaks the privacy model); raw-transfer verification reinvents a fragile facilitator; L402 needs Lightning infra |
| **Metering model** | **per-note payment · prepaid credits · subscription** | **per-note** | Sending a note is not latency-critical, so the native per-request x402 model fits with no need for credit amortisation (an explicit contrast with latency-critical domains, discussed in the report); subscription reintroduces accounts |
| Settlement store | reuse better-sqlite3 · new external DB | better-sqlite3 | Already the app's store; ACID transactions give atomic, replay-safe nonce redemption (FR5/NFR4) with no new infrastructure |
| Facilitator | Coinbase-hosted · self-run · mock (tests/demo) | interface + mock, hosted for prod | `Facilitator` abstraction (NFR8) lets the demo and suite run without moving real value |
| Enforcement placement | client-side gating · server-side enforcement | server-side | A privacy/abuse control that a client can bypass is no control (NFR2) |

**Risk register**

| ID | Risk | L×I | Mitigation |
|---|---|---|---|
| R1 | Hard timebox (submission 13 Jul 14:00) | certain × high | MoSCoW; Could-haves (FR11/UC7) cut first; report drafted in parallel |
| R2 | Facilitator unavailable in demo | possible × high | `Facilitator` interface + mock settlement; demo runs end-to-end without live value |
| R3 | Payment-verification or replay bug grants free premium | possible × high | Adversarial tests (invalid/duplicate/concurrent); atomic SQLite nonce redemption |
| R4 | Hostile client inflates limits | likely × med | Server-side enforcement of tier ceilings (FR6) with tamper tests |
| R5 | Regression breaks the free path or the end-to-end confidentiality property | possible × high | Free-path characterisation tests; the feature never touches ciphertext or keys |
| R6 | Real-value demo (live USDC) | certain × low | Mock facilitator on camera; author's own wallet only if a live path is shown |

---

## 8. Methodology

- **Process:** solo Kanban (GitHub Projects, WIP limit 2), MoSCoW prioritisation; board + commit history is the auditable record.
- **Testing:** TDD for the security-critical core — classification, tier enforcement, x402 verification, and nonce redemption — red-green-refactor with valid/invalid/duplicate/concurrent payment cases and tamper cases. Free-path characterisation tests guard against regression. The free-vs-premium latency claim (NFR6) is measured and reported.
- **Version control:** Git + GitHub. The baseline commit captures pre-existing darknote and is tagged `v-baseline`; the assessed feature is built in short PR-merged branches with conventional commits and milestone tags (`v0.1-srs`, `v0.2-x402-core`, `v0.3-enforcement`, `v1.0-submission`). GitHub Actions CI runs the suite on every push.
- **Configuration management:** documents versioned with code; the baseline vs increment boundary is explicit in history and in this SRS (§1.1), demonstrating controlled provenance.

## 9. Ethics

- **No human participants, no personal data** — no primary-research ethical approval required (UWE checklist in the report appendix for completeness).
- The feature **strengthens** the privacy posture: it monetises *without* ads, accounts, or tracking, which are the usual privacy-eroding levers. It never touches plaintext (there is none server-side) and does not weaken the end-to-end confidentiality property (NFR3).
- **No custody of funds:** payment settles on-chain to the operator address via the facilitator; the app never holds balances.
- Payments are pseudonymous on-chain. The report's ethics section notes the UK regulatory context lightly — this is a privacy/communications tool with a paid feature, not a financial product or promotion — and addresses the dual-use nature of unreadable messaging honestly (abuse-resistance via cost is part of the design rationale).
- Error surfaces never expose internal infrastructure (FR9).
- **Provenance:** darknote is the author's own prior work, declared as the baseline (§1.1); the assessed contribution is the premium feature built within the assessment window.

## 10. Acceptance criteria / definition of done

- Every **Must** requirement is covered by an automated test recorded in [TRACEABILITY.md](TRACEABILITY.md).
- Security properties NFR1/NFR2/NFR4 have explicit adversarial tests (invalid, duplicate, concurrent, tamper).
- NFR6 (free-path unaffected) is demonstrated and reported.
- Demonstration covers UC1–UC5 end-to-end (premium unlock via mock facilitator).
- CI green at tag `v1.0-submission`.

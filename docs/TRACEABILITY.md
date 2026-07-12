# Requirements traceability matrix

Updated in the same pull request as the tests it records. Verification types: **A** = automated (CI), **M** = scripted manual with screenshot evidence.

FR1–FR4 cover the pre-existing base application (documented context); FR5 onward cover the assessed premium increment. Every *Must* requirement maps to at least one passing automated test, and every security/reliability NFR maps to an explicit adversarial test.

| Req | Priority | Verified by | Type | Status | Evidence |
|---|---|---|---|---|---|
| FR1 | M | `key-derivation.test.ts` — same wallet derives one deterministic X25519 keypair; different wallets differ | A | **pass** | CI |
| FR2 | M | `key-derivation.test.ts` — client-side encryption round-trips; server stores only ciphertext | A | **pass** | CI |
| FR3 | M | `self-destruct.test.ts` — note readable within its allowance, unreadable once exhausted | A | **pass** | CI |
| FR4 | M | `key-derivation.test.ts` — identity is the wallet-derived key; no account or personal data | A | **pass** | CI |
| FR5 | M | `premium.test.ts` + `premiumGate.test.ts` — classify free vs premium; free path takes no payment | A | **pass** | CI |
| FR6 | M | `premiumGate.test.ts` + `notes-route.test.ts` — premium request → 402 + self-describing terms | A | **pass** | CI |
| FR7 | M | `premiumGate.test.ts` + `notes-route.test.ts` — unverified/underpaid create nothing; verified creates | A | **pass** | CI |
| FR8 | M | `premiumStore.test.ts` + `premiumGate.test.ts` — replayed settlement unlocks nothing | A | **pass** | CI |
| FR9 | M | `premium.test.ts` + `premiumGate.test.ts` — ceilings enforced vs tampered body | A | **pass** | CI |
| FR10 | M | `db-premium.test.ts` — premium notes exempt from cleanup | A | **pass** | CI |
| FR11 | M | `notes-route.test.ts` — missing-field + malformed-body errors leak no internals | A | **pass** | CI |
| FR12 | S | `pricing-route.test.ts` + `premium.test.ts` — discovery terms published; per-feature price | A | **pass** | CI |
| FR13 | C | — | — | deprioritised | — |
| NFR1 | — | `premiumGate.test.ts` — invalid / underpaid payment grants nothing | A | **pass** | CI |
| NFR2 | — | `premium.test.ts` — tamper resistance (server-side ceilings) | A | **pass** | CI |
| NFR3 | — | `key-derivation.test.ts` — decryption needs the recipient secret key; server holds none | A | **pass** | CI |
| NFR4 | — | `premiumStore.test.ts` — 50 concurrent redemptions, exactly one succeeds | A | **pass** | CI |
| NFR5 | — | `premiumGate.test.ts` — 402 terms self-describing | A | **pass** | CI |
| NFR6 | — | `nfr6.test.ts` — free path makes zero facilitator calls + latency measurement | A | **pass** | CI |
| NFR9 | — | coverage report | A | pending | CI coverage |

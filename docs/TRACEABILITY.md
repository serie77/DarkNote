# Requirements traceability matrix

Updated in the same pull request as the tests it records. Verification types: **A** = automated (CI), **M** = scripted manual with screenshot evidence.

| Req | Priority | Verified by | Type | Status | Evidence |
|---|---|---|---|---|---|
| FR1 | M | `premium.test.ts` — classify free vs premium | A | **pass** | CI |
| FR2 | M | `premiumGate.test.ts` — free note created, no payment | A | **pass** | CI |
| FR3 | M | `premiumGate.test.ts` — premium request → 402 + self-describing terms | A | **pass** | CI |
| FR4 | M | `premiumGate.test.ts` — unverified/underpaid create nothing; verified creates | A | **pass** | CI |
| FR5 | M | `premiumStore.test.ts` + `premiumGate.test.ts` — replayed settlement unlocks nothing | A | **pass** | CI |
| FR6 | M | `premium.test.ts` + `premiumGate.test.ts` — ceilings enforced vs tampered body | A | **pass** | CI |
| FR7 | M | `db-premium.test.ts` — premium notes exempt from cleanup | A | **pass** | CI |
| FR8 | S | `GET /api/pricing` discovery endpoint | A | pending | test to add |
| FR9 | M | route generic error surfaces | A/M | pending | Results ch. |
| FR10 | S | `premium.test.ts` — per-feature price | A | **pass** | CI |
| FR11 | C | — | — | deprioritised | — |
| NFR1 | — | `premiumGate.test.ts` — invalid / underpaid payment grants nothing | A | **pass** | CI |
| NFR2 | — | `premium.test.ts` — tamper resistance (server-side ceilings) | A | **pass** | CI |
| NFR4 | — | `premiumStore.test.ts` — 50 concurrent redemptions, exactly one succeeds | A | **pass** | CI |
| NFR5 | — | `premiumGate.test.ts` — 402 terms self-describing | A | **pass** | CI |
| NFR6 | — | free-path latency measurement | M | pending | Results ch. |
| NFR9 | — | coverage report | A | pending | CI coverage |

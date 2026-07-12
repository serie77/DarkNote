# Delivery plan

**Deadlines (UK time):** report + video both due **before 14:00, Monday 13 July 2026**. The video has **no late window** — it is submitted first. The report's 48-hour late window caps the mark at 40% and is a fail-safe only.

## Provenance

**DarkNote** is the author's own pre-existing project and forms the baseline (tagged `v-baseline`). The assessed contribution is the **Premium Notes** feature — an x402-gated premium tier — built within the assessment window. The baseline/increment boundary is explicit in Git history and in [SRS.md](SRS.md) §1.1.

## Build schedule

**Saturday 12 July**
- Baseline commit + tag `v-baseline`; commit SRS; tag `v0.1-srs`
- x402 core, TDD: tier classification → `Facilitator` + mock → 402 challenge → settlement verification → atomic nonce redemption (replay-safe); tag `v0.2-x402-core`
- CI running the suite on push

**Sunday 12–13 July**
- Server-side tier enforcement + guaranteed retention; wire premium gate into `POST /api/notes`; pricing/discovery endpoint; tag `v0.3-enforcement`
- Minimal premium UI on the send page (option toggle + pay); free path untouched
- Free-vs-premium latency measurement (NFR6)
- Screenshot evidence per use case; TRACEABILITY.md completed
- Report chapters 1–5 drafted

**Monday 13 July (morning)**
- Report chapters 6–7, references, polish
- Record 15-minute video (face on camera per brief); Panopto test upload done in advance
- **Submit video first**, then report — both before 14:00

## Report-chapter map (module sample template)

| Chapter | Source material |
|---|---|
| 1 Introduction | SRS §1 — the abuse + monetisation problem, DarkNote baseline, product position |
| 2 Method | SRS §8 methodology, §7 risks, §9 ethics, provenance/version-control strategy |
| 3 Research | Messaging spam/abuse economics; paywall & micropayment models; privacy-preserving monetisation (no ads/accounts); x402 & agentic-payment literature; Pugh matrices (payment mechanism, metering model, enforcement placement) |
| 4 Requirements | SRS §3 scenarios, §4 use cases + diagram, §5 FRs, §6 NFRs (ISO/IEC 9126) |
| 5 Design & Development | Baseline crypto/architecture (context) + new component design: classification, x402 sequence, atomic nonce redemption, server-side enforcement; code excerpts |
| 6 Results | Screenshots per use case, adversarial payment/tamper test results, traceability matrix, NFR6 free-path measurement |
| 7 Conclusion | Reflection: choosing per-note x402 vs credits, server-side enforcement, provenance discipline, tool/methodology suitability, lessons learned |

## Video map (presentation brief: MO2 review/evaluate, MO4 reflect)

1. Purpose, outcomes, impact — private notes on Solana + monetising without eroding privacy; live demo UC1–UC5 (premium unlock via mock facilitator) (~5 min)
2. Why the approach was appropriate: x402 over accounts/cards, per-note vs credits, server-side enforcement, end-to-end confidentiality preserved (~5 min)
3. Reflection: research → requirements, building on a prior project with a clean provenance boundary, Kanban under a hard timebox, what worked / what didn't (~5 min)
4. Face on camera throughout for identification; timed dry run before recording

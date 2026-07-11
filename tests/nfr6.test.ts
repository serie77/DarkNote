import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluatePremiumGate } from '../lib/premiumGate';
import { PremiumStore } from '../lib/premiumStore';
import type { Facilitator, SettlementTerms } from '../lib/facilitator';
import type { ParsedPayment } from '../lib/x402';

// Counts settlement calls so we can prove payment stays off the free path.
class CountingFacilitator implements Facilitator {
  calls = 0;
  async verifyAndSettle(payment: ParsedPayment, terms: SettlementTerms) {
    this.calls++;
    return { settled: payment.valid === true && Number(payment.amount) >= terms.amount };
  }
}

let store: PremiumStore;
let fac: CountingFacilitator;
beforeEach(() => {
  store = new PremiumStore(':memory:');
  fac = new CountingFacilitator();
});
afterEach(() => store.close());

describe('payment is off the free path (NFR6)', () => {
  it('creates a free note without any facilitator/payment round-trip', async () => {
    const res = await evaluatePremiumGate({
      body: { ciphertext: 'hello' },
      paymentHeader: null,
      store,
      facilitator: fac,
    });
    expect(res).toEqual({ action: 'create', premium: 0 });
    expect(fac.calls).toBe(0);
  });

  it('measures free vs premium gate latency (reported for NFR6)', async () => {
    const N = 500;
    const time = async (body: object, header: string | null) => {
      const start = performance.now();
      for (let i = 0; i < N; i++) {
        await evaluatePremiumGate({ body, paymentHeader: header, store, facilitator: fac });
      }
      return (performance.now() - start) / N;
    };
    const freeMs = await time({ ciphertext: 'hi' }, null);
    const premiumChallengeMs = await time({ maxReads: 5 }, null);
    // eslint-disable-next-line no-console
    console.log(
      `NFR6 median-ish: free=${freeMs.toFixed(4)}ms/op, premium-challenge=${premiumChallengeMs.toFixed(4)}ms/op`,
    );
    // The free path does no facilitator work; it must not be slower than the
    // premium path (which additionally classifies, prices and issues a nonce).
    expect(freeMs).toBeLessThan(premiumChallengeMs + 1);
  });
});

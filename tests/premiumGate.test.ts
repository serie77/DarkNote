import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluatePremiumGate } from '../lib/premiumGate';
import { PremiumStore } from '../lib/premiumStore';
import { MockFacilitator } from '../lib/facilitator';

let store: PremiumStore;
const facilitator = new MockFacilitator();

beforeEach(() => {
  store = new PremiumStore(':memory:');
});
afterEach(() => {
  store.close();
});

const header = (p: object) => Buffer.from(JSON.stringify(p)).toString('base64');

// Runs the challenge step and returns the issued nonce + quoted price.
async function challenge(body: object) {
  const res = await evaluatePremiumGate({ body, paymentHeader: null, store, facilitator });
  if (!('status' in res) || res.status !== 402 || !res.terms) throw new Error('expected 402 terms');
  return res.terms.accepts[0];
}

describe('evaluatePremiumGate', () => {
  it('creates a free note with no payment (FR5)', async () => {
    const res = await evaluatePremiumGate({
      body: { ciphertext: 'hello' },
      paymentHeader: null,
      store,
      facilitator,
    });
    expect(res).toEqual({ action: 'create', premium: 0 });
  });

  it('returns 402 with self-describing terms for a premium request (FR6, NFR5)', async () => {
    const term = await challenge({ maxReads: 5 });
    expect(term).toMatchObject({ scheme: 'exact', network: 'solana', asset: 'USDC' });
    expect(term.amount).toBeGreaterThan(0);
    expect(term.nonce).toBeTruthy();
  });

  it('rejects an unverified payment and creates nothing (FR7)', async () => {
    const term = await challenge({ maxReads: 5 });
    const res = await evaluatePremiumGate({
      body: { maxReads: 5 },
      paymentHeader: header({ nonce: term.nonce, amount: term.amount, valid: false }),
      store,
      facilitator,
    });
    expect(res).toMatchObject({ status: 402 });
  });

  it('rejects an underpaid settlement (FR7)', async () => {
    const term = await challenge({ maxReads: 5 });
    const res = await evaluatePremiumGate({
      body: { maxReads: 5 },
      paymentHeader: header({ nonce: term.nonce, amount: term.amount - 0.01, valid: true }),
      store,
      facilitator,
    });
    expect(res).toMatchObject({ status: 402 });
  });

  it('creates a premium note after a verified payment (FR7)', async () => {
    const term = await challenge({ maxReads: 5 });
    const res = await evaluatePremiumGate({
      body: { maxReads: 5 },
      paymentHeader: header({ nonce: term.nonce, amount: term.amount, valid: true }),
      store,
      facilitator,
    });
    expect(res).toEqual({ action: 'create', premium: 1 });
  });

  it('never unlocks a second note from a replayed settlement (FR8)', async () => {
    const term = await challenge({ maxReads: 5 });
    const paid = header({ nonce: term.nonce, amount: term.amount, valid: true });

    const first = await evaluatePremiumGate({ body: { maxReads: 5 }, paymentHeader: paid, store, facilitator });
    const replay = await evaluatePremiumGate({ body: { maxReads: 5 }, paymentHeader: paid, store, facilitator });

    expect(first).toEqual({ action: 'create', premium: 1 });
    expect(replay).toMatchObject({ status: 402 });
  });

  it('rejects a request beyond premium ceilings before taking payment (FR9, NFR2)', async () => {
    const res = await evaluatePremiumGate({
      body: { maxReads: 999_999 },
      paymentHeader: null,
      store,
      facilitator,
    });
    expect(res).toMatchObject({ status: 400 });
  });
});

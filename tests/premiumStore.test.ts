import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PremiumStore } from '../lib/premiumStore';

let store: PremiumStore;
beforeEach(() => {
  store = new PremiumStore(':memory:');
});
afterEach(() => {
  store.close();
});

describe('PremiumStore (FR8, NFR4)', () => {
  it('redeems an issued nonce exactly once', () => {
    const nonce = store.issueChallenge(0.5);
    expect(store.redeem(nonce)).toEqual({ ok: true, amount: 0.5 });
  });

  it('rejects a replayed nonce (FR8)', () => {
    const nonce = store.issueChallenge(0.5);
    store.redeem(nonce);
    expect(store.redeem(nonce)).toEqual({ ok: false });
  });

  it('rejects an unknown nonce', () => {
    expect(store.redeem('never-issued')).toEqual({ ok: false });
  });

  it('unlocks exactly once under concurrent redemption of the same nonce (NFR4)', async () => {
    const nonce = store.issueChallenge(0.5);
    const results = await Promise.all(
      Array.from({ length: 50 }, () => Promise.resolve().then(() => store.redeem(nonce))),
    );
    expect(results.filter((r) => r.ok).length).toBe(1);
  });
});

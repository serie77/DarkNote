import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/pricing/route';

// FR12: premium pricing is discoverable before composing a note.
describe('GET /api/pricing (FR12)', () => {
  it('publishes tiers, ceilings and x402 settlement details', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.asset).toBe('USDC');
    expect(body.network).toBe('solana-devnet');
    expect(body.payTo).toBeTruthy();
    expect(body.free.price).toBe(0);
    expect(body.premium.maxReads).toBeGreaterThan(body.free.maxReads);
    expect(body.premium.baseUsdc).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { classify, enforce, priceFor, TIER_LIMITS } from '../lib/premium';

const big = (n: number) => 'x'.repeat(n);

describe('classify (FR1)', () => {
  it('treats a plain single-read note as free', () => {
    expect(classify({ ciphertext: 'hello' })).toBe('free');
    expect(classify({ ciphertext: 'hello', maxReads: 1 })).toBe('free');
  });

  it('treats multi-read, large-payload, or retention requests as premium', () => {
    expect(classify({ maxReads: 5 })).toBe('premium');
    expect(classify({ ciphertext: big(TIER_LIMITS.free.maxCiphertextChars + 1) })).toBe('premium');
    expect(classify({ guaranteedRetention: true })).toBe('premium');
  });

  it('treats an explicit premium request as premium (e.g. GIF attached, long message)', () => {
    expect(classify({ ciphertext: 'hi', premiumRequested: true })).toBe('premium');
  });
});

describe('enforce ceilings (FR6, NFR2)', () => {
  it('bounds a free request to free limits', () => {
    expect(enforce({ ciphertext: 'hi' }, 'free').ok).toBe(true);
    expect(enforce({ maxReads: 5 }, 'free').ok).toBe(false);
    expect(enforce({ ciphertext: big(TIER_LIMITS.free.maxCiphertextChars + 1) }, 'free').ok).toBe(false);
    expect(enforce({ guaranteedRetention: true }, 'free').ok).toBe(false);
  });

  it('rejects a premium request that exceeds premium ceilings even though paid', () => {
    expect(enforce({ maxReads: 500 }, 'premium').ok).toBe(true);
    expect(enforce({ maxReads: TIER_LIMITS.premium.maxReads + 1 }, 'premium').ok).toBe(false);
    expect(enforce({ ciphertext: big(TIER_LIMITS.premium.maxCiphertextChars + 1) }, 'premium').ok).toBe(false);
  });
});

describe('priceFor (FR10)', () => {
  it('prices per requested capability', () => {
    expect(priceFor({ maxReads: 5 })).toBe(0.5); // base only
    expect(priceFor({ maxReads: 20 })).toBe(0.75); // +many reads
    expect(priceFor({ guaranteedRetention: true })).toBe(1.0); // +retention
    expect(priceFor({ ciphertext: big(TIER_LIMITS.free.maxCiphertextChars + 1) })).toBe(0.75); // +large payload
  });
});

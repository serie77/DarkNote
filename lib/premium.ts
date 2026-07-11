/**
 * Premium tier policy for darknote notes (assessed feature).
 *
 * A note-creation request is classified free or premium from the capabilities
 * it asks for, and premium requests are bounded by hard ceilings the server
 * enforces regardless of what the client sends (FR1, FR6, NFR2).
 */

export type Tier = 'free' | 'premium';

export interface NoteCapabilities {
  ciphertext?: string;
  maxReads?: number | null;
  guaranteedRetention?: boolean;
}

export const TIER_LIMITS = {
  free: {
    maxReads: 1,
    maxCiphertextChars: 5_000,
  },
  premium: {
    // Hard ceilings — a request beyond these is rejected even if paid.
    maxReads: 1_000,
    maxCiphertextChars: 100_000,
  },
} as const;

export const PRICING = {
  asset: 'USDC',
  baseUsdc: Number(process.env.PREMIUM_BASE_USDC ?? 0.5),
  // Per-feature surcharges (FR10).
  manyReadsUsdc: Number(process.env.PREMIUM_MANY_READS_USDC ?? 0.25),
  largePayloadUsdc: Number(process.env.PREMIUM_LARGE_PAYLOAD_USDC ?? 0.25),
  retentionUsdc: Number(process.env.PREMIUM_RETENTION_USDC ?? 0.5),
} as const;

const ciphertextLength = (req: NoteCapabilities): number => req.ciphertext?.length ?? 0;
const wantsMultiRead = (req: NoteCapabilities): boolean =>
  typeof req.maxReads === 'number' && req.maxReads > TIER_LIMITS.free.maxReads;
const wantsLargePayload = (req: NoteCapabilities): boolean =>
  ciphertextLength(req) > TIER_LIMITS.free.maxCiphertextChars;
const wantsRetention = (req: NoteCapabilities): boolean => req.guaranteedRetention === true;

/** FR1: a request is premium iff it asks for any capability above the free tier. */
export function classify(req: NoteCapabilities): Tier {
  return wantsMultiRead(req) || wantsLargePayload(req) || wantsRetention(req) ? 'premium' : 'free';
}

export interface EnforceResult {
  ok: boolean;
  error?: string;
}

/**
 * FR6 / NFR2: enforce tier ceilings server-side. Free requests must sit within
 * free limits; premium requests must not exceed premium ceilings. A hostile
 * client that inflates values in the body is bounded here, not trusted.
 */
export function enforce(req: NoteCapabilities, tier: Tier): EnforceResult {
  const len = ciphertextLength(req);
  if (tier === 'free') {
    if (wantsMultiRead(req)) return { ok: false, error: 'Multi-read notes require premium.' };
    if (len > TIER_LIMITS.free.maxCiphertextChars) return { ok: false, error: 'Note exceeds free size limit.' };
    if (wantsRetention(req)) return { ok: false, error: 'Guaranteed retention requires premium.' };
    return { ok: true };
  }
  if (typeof req.maxReads === 'number' && req.maxReads > TIER_LIMITS.premium.maxReads) {
    return { ok: false, error: 'Read count exceeds the maximum.' };
  }
  if (len > TIER_LIMITS.premium.maxCiphertextChars) {
    return { ok: false, error: 'Note exceeds the maximum size.' };
  }
  return { ok: true };
}

/** FR10: price a premium request from the specific capabilities requested. */
export function priceFor(req: NoteCapabilities): number {
  let price = PRICING.baseUsdc;
  if (typeof req.maxReads === 'number' && req.maxReads > 10) price += PRICING.manyReadsUsdc;
  if (wantsLargePayload(req)) price += PRICING.largePayloadUsdc;
  if (wantsRetention(req)) price += PRICING.retentionUsdc;
  return Math.round(price * 100) / 100;
}

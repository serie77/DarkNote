// premium tier policy for DarkNote notes (this is the new bit i built).
// a note comes out free or premium depending on what it asks for, and the
// premium ones get capped by hard ceilings the server enforces no matter what
// the client sends (FR5, FR9, NFR2).

export type Tier = 'free' | 'premium';

export interface NoteCapabilities {
  ciphertext?: string;
  maxReads?: number | null;
  guaranteedRetention?: boolean;
  // The client can opt a note into premium explicitly (e.g. for an attached
  // GIF or a long message). This can only ever make a note cost more, never
  // less, so it is safe to trust: the server still independently forces premium
  // on oversized ciphertext, multi-read and retention.
  premiumRequested?: boolean;
}

export const TIER_LIMITS = {
  free: {
    maxReads: 1,
    // Roughly a 2,000-character plaintext message once encrypted and base64'd.
    maxCiphertextChars: 3_000,
  },
  premium: {
    // Hard ceilings, a request beyond these is rejected even if paid.
    maxReads: 1_000,
    maxCiphertextChars: 100_000,
  },
} as const;

export const PRICING = {
  asset: 'USDC',
  baseUsdc: Number(process.env.PREMIUM_BASE_USDC ?? 0.5),
  // Per-feature surcharges (FR12).
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

const explicitlyPremium = (req: NoteCapabilities): boolean => req.premiumRequested === true;

// FR5: a note is premium if it asks for anything above the free tier.
export function classify(req: NoteCapabilities): Tier {
  return wantsMultiRead(req) || wantsLargePayload(req) || wantsRetention(req) || explicitlyPremium(req)
    ? 'premium'
    : 'free';
}

export interface EnforceResult {
  ok: boolean;
  error?: string;
}

// FR9 / NFR2: enforce the tier ceilings on the server. free notes have to stay
// inside the free limits, premium ones can't blow past the premium ceilings. if
// a client tries to inflate the numbers in the body we catch it here instead of
// trusting it.
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

// FR12: work out the price from whatever capabilities the note actually uses.
export function priceFor(req: NoteCapabilities): number {
  let price = PRICING.baseUsdc;
  if (typeof req.maxReads === 'number' && req.maxReads > 10) price += PRICING.manyReadsUsdc;
  if (wantsLargePayload(req)) price += PRICING.largePayloadUsdc;
  if (wantsRetention(req)) price += PRICING.retentionUsdc;
  return Math.round(price * 100) / 100;
}

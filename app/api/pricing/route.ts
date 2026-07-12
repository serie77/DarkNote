import { NextResponse } from 'next/server';
import { PRICING, TIER_LIMITS } from '@/lib/premium';
import { X402_CONFIG } from '@/lib/x402';

/**
 * Premium pricing discovery (FR12). Lets a client learn the tiers, ceilings, and
 * x402 settlement details before composing a premium note.
 */
export async function GET() {
  return NextResponse.json({
    asset: PRICING.asset,
    network: X402_CONFIG.network,
    payTo: X402_CONFIG.payTo,
    free: {
      maxReads: TIER_LIMITS.free.maxReads,
      maxCiphertextChars: TIER_LIMITS.free.maxCiphertextChars,
      price: 0,
    },
    premium: {
      maxReads: TIER_LIMITS.premium.maxReads,
      maxCiphertextChars: TIER_LIMITS.premium.maxCiphertextChars,
      baseUsdc: PRICING.baseUsdc,
      surcharges: {
        manyReadsUsdc: PRICING.manyReadsUsdc,
        largePayloadUsdc: PRICING.largePayloadUsdc,
        retentionUsdc: PRICING.retentionUsdc,
      },
    },
  });
}

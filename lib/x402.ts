import { randomUUID } from 'crypto';

/**
 * x402 helpers for the premium-note unlock (assessed feature).
 *
 * The premium path answers an unpaid request with HTTP 402 and a machine-
 * readable "accepts" envelope (scheme/network/asset/amount/payTo) plus a nonce
 * that binds a payment to one unlock (FR3, NFR5).
 */

export const X402_CONFIG = {
  asset: 'USDC',
  network: 'solana',
  payTo: process.env.PREMIUM_PAYOUT_ADDRESS ?? 'DarknotePremiumPayoutAddrPlaceholder1111111',
} as const;

export interface PaymentTerms {
  x402Version: 1;
  accepts: Array<{
    scheme: 'exact';
    network: string;
    asset: string;
    amount: number;
    payTo: string;
    resource: string;
    description: string;
    nonce: string;
  }>;
}

export function challengeTerms(nonce: string, amountUsdc: number): PaymentTerms {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: X402_CONFIG.network,
        asset: X402_CONFIG.asset,
        amount: amountUsdc,
        payTo: X402_CONFIG.payTo,
        resource: '/api/notes',
        description: 'darknote premium note',
        nonce,
      },
    ],
  };
}

export interface ParsedPayment {
  nonce: string;
  amount: number;
  valid?: boolean;
  payer?: string;
}

/** Parse the base64-encoded JSON X-PAYMENT header; null on any malformation. */
export function parsePaymentHeader(header: string | null | undefined): ParsedPayment | null {
  if (!header || typeof header !== 'string') return null;
  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (typeof decoded?.nonce !== 'string' || typeof decoded?.amount !== 'number') return null;
    return decoded as ParsedPayment;
  } catch {
    return null;
  }
}

export function newNonce(): string {
  return randomUUID();
}

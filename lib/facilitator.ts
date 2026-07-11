import type { ParsedPayment } from './x402';

/**
 * Payment verification/settlement behind a swappable interface (NFR8), so the
 * premium gate never depends on a concrete facilitator and the test suite and
 * demo can run without moving real value on-chain.
 */
export interface SettlementTerms {
  nonce: string;
  amount: number;
}

export interface Settlement {
  settled: boolean;
  txSig?: string;
}

export interface Facilitator {
  verifyAndSettle(payment: ParsedPayment, terms: SettlementTerms): Promise<Settlement>;
}

/**
 * Mock facilitator for tests and the recorded demo. Treats a payment as settled
 * only when it is marked valid, targets the challenged nonce, and pays at least
 * the required amount — mirroring a real facilitator's acceptance checks so the
 * gate logic is exercised faithfully.
 */
export class MockFacilitator implements Facilitator {
  async verifyAndSettle(payment: ParsedPayment, terms: SettlementTerms): Promise<Settlement> {
    if (payment.valid !== true) return { settled: false };
    if (payment.nonce !== terms.nonce) return { settled: false };
    if (Number(payment.amount) < terms.amount) return { settled: false };
    return { settled: true, txSig: `mock-settlement:${payment.nonce}` };
  }
}

/** Real facilitator adapter; network/verification failure => not settled. */
export class HttpFacilitator implements Facilitator {
  constructor(private readonly url: string) {}
  async verifyAndSettle(payment: ParsedPayment, terms: SettlementTerms): Promise<Settlement> {
    try {
      const res = await fetch(`${this.url}/settle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment, terms }),
      });
      if (!res.ok) return { settled: false };
      const body = await res.json();
      return { settled: Boolean(body.settled), txSig: body.txSig };
    } catch {
      return { settled: false };
    }
  }
}

let cached: Facilitator | null = null;
export function getFacilitator(): Facilitator {
  if (!cached) {
    const url = process.env.X402_FACILITATOR_URL;
    cached = url ? new HttpFacilitator(url) : new MockFacilitator();
  }
  return cached;
}

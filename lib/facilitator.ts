import type { ParsedPayment } from './x402';

// payment verify/settle sits behind a swappable interface (NFR8), so the gate
// doesn't care which facilitator is behind it. that's the whole trick that lets
// the tests and the demo run without moving real money.
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

// mock facilitator for the tests and the demo. it only counts a payment as
// settled if it's marked valid, points at the nonce we challenged with, and
// pays at least the amount we asked for, roughly the same checks a real
// facilitator does, so the gate still gets exercised properly.
export class MockFacilitator implements Facilitator {
  async verifyAndSettle(payment: ParsedPayment, terms: SettlementTerms): Promise<Settlement> {
    if (payment.valid !== true) return { settled: false };
    if (payment.nonce !== terms.nonce) return { settled: false };
    if (Number(payment.amount) < terms.amount) return { settled: false };
    return { settled: true, txSig: `mock-settlement:${payment.nonce}` };
  }
}

// real facilitator adapter. if the network call or verification fails we just
// treat it as not settled.
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

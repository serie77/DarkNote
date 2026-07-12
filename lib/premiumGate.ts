import { classify, enforce, priceFor, type NoteCapabilities } from './premium';
import { challengeTerms, parsePaymentHeader, type PaymentTerms } from './x402';
import type { Facilitator } from './facilitator';
import type { PremiumStore } from './premiumStore';

// works out whether a note can go through, and at which tier.
//
// this is the security-sensitive bit, so i kept it as one pure function with
// its deps injected. that way i can unit-test it to death without spinning up
// Next or a real facilitator, and the route handler just wraps it.
//
// it hands back one of:
//   { action: 'create', premium }   -> go ahead and create the note
//   { status: 402, terms?, error? } -> needs payment / payment didn't check out
//   { status: 400, error }          -> asked for more than premium allows
export type GateDecision =
  | { action: 'create'; premium: 0 | 1 }
  | { status: 402; terms?: PaymentTerms; error?: string }
  | { status: 400; error: string };

export interface GateDeps {
  body: NoteCapabilities;
  paymentHeader: string | null | undefined;
  store: PremiumStore;
  facilitator: Facilitator;
}

export async function evaluatePremiumGate({
  body,
  paymentHeader,
  store,
  facilitator,
}: GateDeps): Promise<GateDecision> {
  const tier = classify(body); // FR5

  if (tier === 'free') {
    const check = enforce(body, 'free');
    // if it's free it's already inside the free limits, so this is just
    // belt-and-braces.
    if (!check.ok) return { status: 400, error: check.error! };
    return { action: 'create', premium: 0 }; // FR5: free notes never pay
  }

  // premium: cap the request BEFORE we take any money (FR9 / NFR2).
  const ceilings = enforce(body, 'premium');
  if (!ceilings.ok) return { status: 400, error: ceilings.error! };

  const price = priceFor(body);

  // FR6: nobody's paid yet, so mint a challenge nonce and hand back the 402.
  if (!paymentHeader) {
    const nonce = store.issueChallenge(price);
    return { status: 402, terms: challengeTerms(nonce, price) };
  }

  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    const nonce = store.issueChallenge(price);
    return { status: 402, terms: challengeTerms(nonce, price), error: 'Invalid payment.' };
  }

  // FR7: the facilitator has to confirm settlement before we hand anything over.
  const settlement = await facilitator.verifyAndSettle(payment, { nonce: payment.nonce, amount: price });
  if (!settlement.settled) {
    return { status: 402, error: 'Payment could not be verified.' };
  }

  // FR8: burn the nonce atomically. replay it or make one up and it unlocks
  // nothing, so one payment can only ever make one premium note.
  const redeemed = store.redeem(payment.nonce);
  if (!redeemed.ok) {
    return { status: 402, error: 'Payment already used or unrecognised.' };
  }

  return { action: 'create', premium: 1 };
}

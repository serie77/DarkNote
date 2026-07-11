import { classify, enforce, priceFor, type NoteCapabilities } from './premium';
import { challengeTerms, parsePaymentHeader, type PaymentTerms } from './x402';
import type { Facilitator } from './facilitator';
import type { PremiumStore } from './premiumStore';

/**
 * Decides whether a note-creation request may proceed, and at which tier.
 *
 * This is the security-critical orchestration, kept as one pure, injectable
 * function so it is fully unit-testable without the Next.js runtime or a live
 * facilitator. The route handler is a thin wrapper around it.
 *
 * Returns one of:
 *   { action: 'create', premium }        -> create the note (premium 0 or 1)
 *   { status: 402, terms?, error? }      -> payment required / not verified
 *   { status: 400, error }               -> request beyond premium ceilings
 */
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
  const tier = classify(body); // FR1

  if (tier === 'free') {
    const check = enforce(body, 'free');
    // A free-classified request is within free limits by construction; this is
    // defence in depth.
    if (!check.ok) return { status: 400, error: check.error! };
    return { action: 'create', premium: 0 }; // FR2: no payment on the free path
  }

  // Premium: bound the request before taking any payment (FR6 / NFR2).
  const ceilings = enforce(body, 'premium');
  if (!ceilings.ok) return { status: 400, error: ceilings.error! };

  const price = priceFor(body);

  // FR3: no payment yet -> issue a challenge nonce and return 402 terms.
  if (!paymentHeader) {
    const nonce = store.issueChallenge(price);
    return { status: 402, terms: challengeTerms(nonce, price) };
  }

  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    const nonce = store.issueChallenge(price);
    return { status: 402, terms: challengeTerms(nonce, price), error: 'Invalid payment.' };
  }

  // FR4: settlement must be facilitator-verified before anything is granted.
  const settlement = await facilitator.verifyAndSettle(payment, { nonce: payment.nonce, amount: price });
  if (!settlement.settled) {
    return { status: 402, error: 'Payment could not be verified.' };
  }

  // FR5: consume the nonce atomically — a replay or an unknown nonce unlocks
  // nothing, so one settlement creates at most one premium note.
  const redeemed = store.redeem(payment.nonce);
  if (!redeemed.ok) {
    return { status: 402, error: 'Payment already used or unrecognised.' };
  }

  return { action: 'create', premium: 1 };
}

import { NextRequest, NextResponse } from 'next/server';
import { createNote } from '@/lib/db';
import { PublicKey } from '@solana/web3.js';
import { evaluatePremiumGate } from '@/lib/premiumGate';
import { getPremiumStore } from '@/lib/premiumStore';
import { getFacilitator } from '@/lib/facilitator';
import { classify, enforce, priceFor } from '@/lib/premium';
import { X402_MODE, getX402Handler, premiumRouteConfig } from '@/lib/x402Solana';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      ciphertext,
      nonce,
      ephemeralPublicKey,
      recipientAddress,
      selfDestruct = true,
      maxReads = null,
      guaranteedRetention = false,
      premiumRequested = false,
    } = body;

    // Validate required fields
    if (!id || !ciphertext || !nonce || !ephemeralPublicKey || !recipientAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate Solana address
    try {
      new PublicKey(recipientAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    const caps = { ciphertext, maxReads, guaranteedRetention, premiumRequested };

    // actually persist the note. the server only ever sees ciphertext, so this
    // is the same whether payment came from the mock or a real settlement.
    const persist = (premium: boolean) => {
      const note = createNote({
        id,
        ciphertext,
        nonce,
        ephemeralPublicKey,
        recipientAddress,
        selfDestruct,
        maxReads,
        premium,
      });
      return NextResponse.json({ success: true, noteId: note.id, premium });
    };

    // real settlement on Solana devnet, only when it's switched on AND the note
    // is premium. free notes (always) and premium-in-mock-mode fall through to
    // the gate below, so the tested mock path is left completely alone.
    if (X402_MODE === 'devnet' && classify(caps) === 'premium') {
      const ceilings = enforce(caps, 'premium');
      if (!ceilings.ok) {
        return NextResponse.json({ error: ceilings.error }, { status: 400 });
      }
      const handler = getX402Handler();
      const resourceUrl = new URL(request.url).toString();
      const requirements = await handler.createPaymentRequirements(
        premiumRouteConfig(priceFor(caps)),
        resourceUrl,
      );
      const paymentSig = handler.extractPayment(request.headers);
      if (!paymentSig) {
        const res = handler.create402Response(requirements, resourceUrl);
        return NextResponse.json(res.body, { status: 402 });
      }
      const verified = await handler.verifyPayment(paymentSig, requirements);
      if (!verified.isValid) {
        return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 402 });
      }
      const settled = await handler.settlePayment(paymentSig, requirements);
      if (!settled.success) {
        return NextResponse.json({ error: 'Payment could not be settled.' }, { status: 402 });
      }
      return persist(true);
    }

    // the assessed gate: classify, enforce ceilings, and take a (mock) x402
    // payment for premium notes. free notes pass straight through, unchanged,
    // and the server never sees a decryption key.
    const gate = await evaluatePremiumGate({
      body: caps,
      paymentHeader: request.headers.get('x-payment'),
      store: getPremiumStore(),
      facilitator: getFacilitator(),
    });

    if ('status' in gate) {
      if (gate.status === 402) {
        return NextResponse.json(gate.terms ?? { error: gate.error }, { status: 402 });
      }
      return NextResponse.json({ error: gate.error }, { status: 400 });
    }

    return persist(gate.premium === 1);
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

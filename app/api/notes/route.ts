import { NextRequest, NextResponse } from 'next/server';
import { createNote } from '@/lib/db';
import { PublicKey } from '@solana/web3.js';
import { evaluatePremiumGate } from '@/lib/premiumGate';
import { getPremiumStore } from '@/lib/premiumStore';
import { getFacilitator } from '@/lib/facilitator';

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
      giftAmountSol = null,
      giftTxSignature = null
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

    // Premium gate (assessed increment): classify the request, enforce tier
    // ceilings server-side, and require a verified x402 payment for premium
    // capability. Free notes pass straight through, unchanged.
    const gate = await evaluatePremiumGate({
      body: { ciphertext, maxReads, guaranteedRetention },
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

    // ZERO-KNOWLEDGE ASYMMETRIC: We store ciphertext + ephemeral public key
    // Only recipient's secret key can decrypt - server literally cannot decrypt
    const note = createNote({
      id,
      ciphertext,
      nonce,
      ephemeralPublicKey,
      recipientAddress,
      selfDestruct,
      maxReads,
      giftAmountSol,
      giftTxSignature,
      premium: gate.premium === 1,
    });

    return NextResponse.json({
      success: true,
      noteId: note.id,
      premium: gate.premium === 1,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

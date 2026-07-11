import { NextRequest, NextResponse } from 'next/server';
import { createNote } from '@/lib/db';
import { PublicKey } from '@solana/web3.js';

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

    // Validate string lengths (prevent abuse)
    if (ciphertext.length > 100000) {
      return NextResponse.json(
        { error: 'Message too large' },
        { status: 400 }
      );
    }

    // Validate maxReads
    if (maxReads !== null && (typeof maxReads !== 'number' || maxReads < 1 || maxReads > 1000)) {
      return NextResponse.json(
        { error: 'Invalid maxReads value' },
        { status: 400 }
      );
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
    });

    return NextResponse.json({
      success: true,
      noteId: note.id,
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

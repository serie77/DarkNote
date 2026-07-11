import { NextRequest, NextResponse } from 'next/server';
import { getRegisteredKey } from '@/lib/db';
import { PublicKey } from '@solana/web3.js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    // Validate Solana address
    try {
      new PublicKey(address);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    const key = getRegisteredKey(address);

    if (!key) {
      return NextResponse.json(
        { error: 'No encryption key registered for this address' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      walletAddress: key.walletAddress,
      encryptionPublicKey: key.encryptionPublicKey,
      registeredAt: key.registeredAt,
    });
  } catch (error) {
    console.error('Error fetching key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch key' },
      { status: 500 }
    );
  }
}

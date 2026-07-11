import { NextRequest, NextResponse } from 'next/server';
import { registerKey } from '@/lib/db';
import { PublicKey } from '@solana/web3.js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, encryptionPublicKey } = body;

    // Validate required fields
    if (!walletAddress || !encryptionPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate Solana address
    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Solana address' },
        { status: 400 }
      );
    }

    // Validate encryption public key is base64 and 32 bytes
    try {
      const decoded = Buffer.from(encryptionPublicKey, 'base64');
      if (decoded.length !== 32) {
        throw new Error('Invalid key length');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid encryption public key' },
        { status: 400 }
      );
    }

    // Register the key
    const registered = registerKey({
      walletAddress,
      encryptionPublicKey,
    });

    return NextResponse.json({
      success: true,
      walletAddress: registered.walletAddress,
      registeredAt: registered.registeredAt,
    });
  } catch (error) {
    console.error('Error registering key:', error);
    return NextResponse.json(
      { error: 'Failed to register key' },
      { status: 500 }
    );
  }
}

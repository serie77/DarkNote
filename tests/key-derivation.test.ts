import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import {
  deriveEncryptionKeyFromSignature,
  encryptMessage,
  decryptMessage,
  parseEncryptedNotePayload,
} from '../lib/crypto';

// A deterministic stand-in for a wallet's signMessage: the signature is a pure
// function of the signed bytes, so the same wallet address always yields the
// same signature (as a real wallet does for a fixed message) and different
// addresses yield different signatures. This lets us exercise the derivation
// without a live wallet.
const fakeSign = async (message: Uint8Array) => nacl.hash(message).slice(0, 64);

const WALLET_A = 'So11111111111111111111111111111111111111112';
const WALLET_B = 'DarkNoteBaseTestWallet11111111111111111111';

describe('wallet-key derivation (FR1, FR2, FR4, NFR3)', () => {
  it('derives the same X25519 keypair every time for one wallet (FR1)', async () => {
    const k1 = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_A);
    const k2 = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_A);
    expect(k1.publicKey).toBe(k2.publicKey);
    expect(k1.secretKey).toBe(k2.secretKey);
    // FR4: the only identity input is the public wallet address — no account,
    // password or personal data participates in deriving the key.
  });

  it('derives different keys for different wallets (FR1)', async () => {
    const a = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_A);
    const b = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_B);
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.secretKey).not.toBe(b.secretKey);
  });

  it('round-trips a message through the derived keypair, and only the secret key can open it (FR2, NFR3)', async () => {
    const { publicKey, secretKey } = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_A);
    const secret = 'meet me at the usual place';

    // Sender encrypts to the recipient's public key. The server only ever stores
    // these three fields — never a key capable of decryption (FR2).
    const { ciphertext, nonce, ephemeralPublicKey } = encryptMessage(secret, publicKey);
    expect(ciphertext).not.toContain(secret);

    // NFR3: a different wallet's secret key cannot open it; confidentiality does
    // not depend on the server, which holds no decryption key.
    const other = await deriveEncryptionKeyFromSignature(fakeSign, WALLET_B);
    expect(() => decryptMessage(ciphertext, nonce, ephemeralPublicKey, other.secretKey)).toThrow();

    const opened = decryptMessage(ciphertext, nonce, ephemeralPublicKey, secretKey);
    expect(parseEncryptedNotePayload(opened)?.text).toBe(secret);
  });
});

import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface EncryptedNotePayload {
  v: 1;
  text: string;
  emote?: string;
  gifUrl?: string;
}

export type GifPreviewKind = 'image' | 'iframe' | 'video';

export interface GifPreviewInfo {
  kind: GifPreviewKind;
  src: string;
}

export type InlineMessagePart =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string }
  | { kind: 'media'; value: string; media: GifPreviewInfo };

/**
 * TRUE ZERO-KNOWLEDGE ASYMMETRIC ENCRYPTION
 *
 * Uses NaCl box (X25519 key agreement + XSalsa20-Poly1305 AEAD)
 *
 * Flow:
 * 1. Sender generates ephemeral keypair (forward secrecy)
 * 2. Encrypts with recipient's public X25519 key
 * 3. Server stores: ciphertext + ephemeral public key
 * 4. Only recipient's private key can decrypt
 *
 * Benefits:
 * - No passwords in URLs
 * - Forward secrecy (ephemeral sender key)
 * - Only wallet owner can decrypt
 * - Server literally cannot decrypt
 */

/**
 * Encrypt message for recipient using NaCl box
 * Generates ephemeral keypair for forward secrecy
 */
export function encryptMessage(
  message: string | EncryptedNotePayload,
  recipientPublicKey: string
): {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
} {
  // Validate recipient public key
  const recipientPubKeyBytes = decodeBase64(recipientPublicKey);
  if (recipientPubKeyBytes.length !== 32) {
    throw new Error('Invalid recipient public key (must be 32 bytes)');
  }

  // Generate ephemeral keypair for THIS message only (forward secrecy)
  const ephemeralKeypair = nacl.box.keyPair();

  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt a small structured payload so we can carry text, emotes, and GIFs.
  const payload = typeof message === 'string' ? ({ v: 1, text: message } satisfies EncryptedNotePayload) : message;
  const messageBytes = decodeUTF8(JSON.stringify(payload));
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPubKeyBytes,
    ephemeralKeypair.secretKey
  );

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeralKeypair.publicKey),
  };
}

/**
 * Decrypt message using recipient's secret key
 */
export function decryptMessage(
  ciphertext: string,
  nonce: string,
  ephemeralPublicKey: string,
  recipientSecretKey: string
): string {
  try {
    const ciphertextBytes = decodeBase64(ciphertext);
    const nonceBytes = decodeBase64(nonce);
    const ephemeralPubKeyBytes = decodeBase64(ephemeralPublicKey);
    const recipientSecretKeyBytes = decodeBase64(recipientSecretKey);

    // Decrypt using NaCl box
    const decrypted = nacl.box.open(
      ciphertextBytes,
      nonceBytes,
      ephemeralPubKeyBytes,
      recipientSecretKeyBytes
    );

    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}

export function parseEncryptedNotePayload(message: string): EncryptedNotePayload | null {
  try {
    const parsed = JSON.parse(message) as Partial<EncryptedNotePayload>;
    if (parsed && parsed.v === 1 && typeof parsed.text === 'string') {
      return {
        v: 1,
        text: parsed.text,
        emote: typeof parsed.emote === 'string' ? parsed.emote : undefined,
        gifUrl: typeof parsed.gifUrl === 'string' ? parsed.gifUrl : undefined,
      };
    }
  } catch {
    // Plaintext legacy notes fall through.
  }

  return null;
}

export function getDisplayMessageText(message: string, payload: EncryptedNotePayload | null): string {
  if (!payload) {
    return message;
  }

  const lines: string[] = [];
  const primaryText = payload.emote ? `${payload.emote} ${payload.text}`.trim() : payload.text;

  if (primaryText) {
    lines.push(primaryText);
  }

  if (payload.gifUrl) {
    lines.push(payload.gifUrl);
  }

  return lines.join('\n\n') || message;
}

export function getGifPreviewInfo(rawUrl: string): GifPreviewInfo | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();
  const mediaLikeHost =
    host.endsWith('discordapp.com') ||
    host.endsWith('discord.com') ||
    host.endsWith('tenor.com') ||
    host.endsWith('giphy.com') ||
    host.endsWith('giphyusercontent.com') ||
    host.endsWith('imgur.com') ||
    host.endsWith('twimg.com');

  if (
    /\.(gif|webp|png|jpg|jpeg|avif)$/i.test(path) ||
    /[?&](format|fm)=(gif|webp|png|jpg|jpeg|avif)(?:&|$)/i.test(search) ||
    /[?&]response-content-type=image%2f/i.test(search) ||
    (mediaLikeHost && /(\/attachments\/|\/media\/|\/images\/|\/image\/|\/originals\/)/i.test(path))
  ) {
    return { kind: 'image', src: parsed.toString() };
  }

  if (host === 'tenor.com' || host.endsWith('.tenor.com')) {
    const tenorId = parsed.pathname.match(/(?:-|\/)(\d{8,})(?:\/)?$/)?.[1];
    if (tenorId) {
      return { kind: 'iframe', src: `https://tenor.com/embed/${tenorId}` };
    }
  }

  if (host === 'giphy.com' || host.endsWith('.giphy.com')) {
    const giphyId = parsed.pathname.match(/(?:-|\/)([a-zA-Z0-9]+)(?:\/)?$/)?.[1];
    if (giphyId && !parsed.pathname.startsWith('/embed/')) {
      return { kind: 'iframe', src: `https://giphy.com/embed/${giphyId}` };
    }

    return { kind: 'iframe', src: parsed.toString() };
  }

  if (
    /\.(mp4|webm)$/i.test(path) ||
    /[?&](format|fm)=(mp4|webm)(?:&|$)/i.test(search) ||
    /[?&]response-content-type=video%2f/i.test(search)
  ) {
    return { kind: 'video', src: parsed.toString() };
  }

  return null;
}

export function parseInlineMessageParts(message: string): InlineMessagePart[] {
  const tokens = message.split(/(\s+)/);
  const parts: InlineMessagePart[] = [];

  for (const token of tokens) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      parts.push({ kind: 'text', value: token });
      continue;
    }

    try {
      const parsed = new URL(token);
      if (parsed.protocol === 'https:') {
        const media = getGifPreviewInfo(token);
        if (media) {
          parts.push({ kind: 'media', value: token, media });
        } else {
          parts.push({ kind: 'link', value: token });
        }
        continue;
      }
    } catch {
      // Not a URL; fall through to plain text.
    }

    parts.push({ kind: 'text', value: token });
  }

  return parts;
}

/**
 * Derive X25519 encryption keypair from wallet signature
 *
 * IMPORTANT: This is a workaround since we can't directly convert Ed25519 secret keys
 * to X25519 secret keys (wallets don't expose their Ed25519 private keys).
 *
 * Instead, we:
 * 1. Ask wallet to sign a deterministic message
 * 2. Hash the signature to create a 32-byte seed
 * 3. Generate X25519 keypair from that seed
 *
 * This means the encryption key is DERIVED from the wallet, not CONVERTED from it.
 * Same wallet signature → same encryption keypair (deterministic).
 *
 * @param signMessage - Wallet's signMessage function
 * @param walletAddress - Base58 Solana wallet address
 * @returns X25519 keypair for encryption
 */
export async function deriveEncryptionKeyFromSignature(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string
): Promise<{ publicKey: string; secretKey: string }> {
  // Create deterministic message to sign
  const message = decodeUTF8(`DarkNote encryption key for ${walletAddress}`);

  // Get signature (proves wallet ownership)
  const signature = await signMessage(message);

  // Use signature as seed for keypair (deterministic)
  const seed = nacl.hash(signature).slice(0, 32);
  const keypair = nacl.box.keyPair.fromSecretKey(seed);

  return {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
  };
}

/**
 * Generate a random note ID
 */
export function generateNoteId(): string {
  const bytes = nacl.randomBytes(16);
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

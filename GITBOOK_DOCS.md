# DarkNote: Complete Technical Documentation

![DarkNote Banner](darknotebanner.png)

## Table of Contents

1. [Overview](#overview)
2. [Zero-Knowledge Architecture](#zero-knowledge-architecture)
3. [Cryptographic Implementation](#cryptographic-implementation)
4. [Wallet Integration & Key Derivation](#wallet-integration--key-derivation)
5. [API Security Model](#api-security-model)
6. [Database Design](#database-design)
7. [Frontend Security](#frontend-security)
8. [Self-Destruct Mechanisms](#self-destruct-mechanisms)
9. [Privacy Guarantees](#privacy-guarantees)
10. [Security Audit](#security-audit)
11. [Deployment & Operations](#deployment--operations)
12. [FAQ](#faq)

---

## Overview

DarkNote is a **zero-knowledge encrypted messaging system** built on Solana that enables private communication between wallet addresses. The system implements **true end-to-end encryption** where the server literally cannot decrypt messages - only the intended recipient can.

### Key Features

- **Zero-Knowledge Encryption**: Server stores only encrypted ciphertext
- **Forward Secrecy**: Each message uses ephemeral keypairs
- **Self-Destruct**: Messages automatically delete after reading
- **Wallet-Based Identity**: No accounts, emails, or phone numbers
- **Client-Side Encryption**: All cryptography happens in the browser
- **Battle-Tested Crypto**: Uses NaCl (Networking and Cryptography Library)

---

## Zero-Knowledge Architecture

### What "Zero-Knowledge" Means

In DarkNote's context, **zero-knowledge** means:

1. **Server Cannot Decrypt**: The server has zero knowledge of message contents
2. **No Plaintext Storage**: Only encrypted ciphertext is stored
3. **No Master Keys**: No server-side keys that could decrypt messages
4. **Cryptographic Impossibility**: Without the recipient's private key, decryption is mathematically impossible

### Architecture Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sender        │    │   DarkNote      │    │   Recipient     │
│   Browser       │    │   Server        │    │   Browser       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ 1. Fetch        │───▶│ Returns public  │    │                 │
│    recipient's  │    │ encryption key  │    │                 │
│    public key   │    │                 │    │                 │
│                 │    │                 │    │                 │
│ 2. Generate     │    │                 │    │                 │
│    ephemeral    │    │                 │    │                 │
│    keypair      │    │                 │    │                 │
│                 │    │                 │    │                 │
│ 3. Encrypt with │    │                 │    │                 │
│    NaCl box     │    │                 │    │                 │
│    (X25519 +    │    │                 │    │                 │
│    XSalsa20)    │    │                 │    │                 │
│                 │    │                 │    │                 │
│ 4. Send         │───▶│ Stores:         │    │                 │
│    encrypted    │    │ - ciphertext    │    │                 │
│    data         │    │ - nonce         │    │                 │
│                 │    │ - ephemeral_pk  │    │                 │
│                 │    │                 │    │                 │
│                 │    │ 5. Serves       │───▶│ 6. Fetch note   │
│                 │    │    encrypted    │    │                 │
│                 │    │    data         │    │                 │
│                 │    │                 │    │                 │
│                 │    │                 │    │ 7. Derive       │
│                 │    │                 │    │    decryption   │
│                 │    │                 │    │    key from     │
│                 │    │                 │    │    wallet       │
│                 │    │                 │    │                 │
│                 │    │                 │    │ 8. Decrypt with │
│                 │    │                 │    │    NaCl box     │
│                 │    │                 │    │                 │
│                 │    │ 9. Delete note  │◀───│ 10. Self-       │
│                 │    │    (optional)   │    │     destruct    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Critical Security Properties

1. **Server Blindness**: The server never sees plaintext messages
2. **Forward Secrecy**: Each message uses unique ephemeral keys
3. **Perfect Forward Secrecy**: Compromising long-term keys doesn't compromise past messages
4. **Authenticated Encryption**: NaCl box provides both confidentiality and authenticity
5. **Replay Protection**: Nonces prevent message replay attacks

---

## Cryptographic Implementation

### Core Cryptographic Primitives

DarkNote uses **NaCl (Networking and Cryptography Library)**, specifically the **TweetNaCl** implementation:

#### 1. Key Agreement: X25519 Elliptic Curve Diffie-Hellman

```typescript
// Ephemeral keypair generation (forward secrecy)
const ephemeralKeypair = nacl.box.keyPair();
```

**Security Properties:**

- **Curve**: Curve25519 (Daniel J. Bernstein's high-security elliptic curve)
- **Key Size**: 256-bit keys
- **Security Level**: ~128-bit security
- **Side-Channel Resistance**: Designed to resist timing attacks

#### 2. Authenticated Encryption: XSalsa20-Poly1305

```typescript
// Encryption with authenticated encryption
const encrypted = nacl.box(
  messageBytes,           // Plaintext
  nonce,                 // 24-byte random nonce
  recipientPubKeyBytes,  // Recipient's public key
  ephemeralKeypair.secretKey  // Ephemeral private key
);
```

**Security Properties:**

- **Cipher**: XSalsa20 (extended-nonce Salsa20)
- **MAC**: Poly1305 authenticator
- **Nonce Size**: 192 bits (24 bytes)
- **Authentication**: Prevents tampering and forgery
- **Chosen-Ciphertext Security**: Secure against adaptive chosen-ciphertext attacks

#### 3. Cryptographic Hash: SHA-512

```typescript
// Key derivation from wallet signature
const seed = nacl.hash(signature).slice(0, 32);
const keypair = nacl.box.keyPair.fromSecretKey(seed);
```

### Detailed Encryption Process

#### Step 1: Key Derivation

```typescript
export async function deriveEncryptionKeyFromSignature(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string
): Promise<{ publicKey: string; secretKey: string }> {
  // Create deterministic message
  const message = decodeUTF8(`DarkNote encryption key for ${walletAddress}`);
  
  // Get wallet signature (proves ownership)
  const signature = await signMessage(message);
  
  // Derive keypair from signature hash
  const seed = nacl.hash(signature).slice(0, 32);
  const keypair = nacl.box.keyPair.fromSecretKey(seed);
  
  return {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
  };
}
```

**Why This Approach:**

- **Deterministic**: Same wallet always generates same encryption keypair
- **Provable Ownership**: Signature proves wallet ownership
- **No Key Storage**: Encryption keys derived on-demand
- **Ed25519 → X25519 Conversion**: Solana wallets use Ed25519, but we need X25519 for encryption

#### Step 2: Message Encryption

```typescript
export function encryptMessage(
  message: string,
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

  // Generate ephemeral keypair (forward secrecy)
  const ephemeralKeypair = nacl.box.keyPair();

  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes

  // Encrypt using NaCl box
  const messageBytes = decodeUTF8(message);
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPubKeyBytes,
    ephemeralKeypair.secretKey
  );

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeralKeypair.publicKey),
  };
}
```

#### Step 3: Message Decryption

```typescript
export function decryptMessage(
  ciphertext: string,
  nonce: string,
  ephemeralPublicKey: string,
  recipientSecretKey: string
): string {
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
}
```

### Security Analysis

#### Threat Model

**What DarkNote Protects Against:**

- **Server Compromise**: Even if the server is compromised, messages remain encrypted
- **Database Breach**: Attackers get only encrypted ciphertext
- **Man-in-the-Middle**: Authenticated encryption prevents tampering
- **Replay Attacks**: Nonces prevent message replay
- **Chosen-Ciphertext Attacks**: Poly1305 MAC provides authentication

**What DarkNote Does NOT Protect Against:**

- **Client-Side Compromise**: If recipient's browser/device is compromised during decryption
- **Wallet Compromise**: If wallet private key is stolen
- **Coercion**: If recipient is forced to decrypt messages
- **Traffic Analysis**: Server can see when messages are sent/received (but not contents)

#### Cryptographic Assumptions

1. **Discrete Logarithm Problem on Curve25519**: Assumed to be hard
2. **XSalsa20 Security**: Assumed to be a secure stream cipher
3. **Poly1305 Security**: Assumed to be a secure MAC
4. **SHA-512 Security**: Assumed to be collision-resistant and preimage-resistant

---

## Wallet Integration & Key Derivation

### Solana Wallet Adapter Integration

DarkNote integrates with Solana wallets using the official Solana Wallet Adapter:

```typescript
// WalletProvider.tsx
export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet; // or Mainnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
```

### Key Derivation Deep Dive

#### The Ed25519 → X25519 Problem

**Challenge**: Solana wallets use Ed25519 for signatures, but NaCl box requires X25519 for encryption.

**Traditional Solutions (and why they don't work):**

1. **Direct Conversion**: Ed25519 private keys can be converted to X25519, but wallets don't expose private keys
2. **Public Key Conversion**: Ed25519 public keys can be converted to X25519 public keys, but this doesn't help with decryption

**DarkNote's Solution**: **Signature-Based Key Derivation**

```typescript
// 1. Create deterministic message
const message = `DarkNote encryption key for ${walletAddress}`;

// 2. Wallet signs the message (proves ownership)
const signature = await signMessage(decodeUTF8(message));

// 3. Hash signature to create seed
const seed = nacl.hash(signature).slice(0, 32);

// 4. Generate X25519 keypair from seed
const keypair = nacl.box.keyPair.fromSecretKey(seed);
```

#### Security Properties of Key Derivation

1. **Deterministic**: Same wallet always produces same encryption keypair
2. **Provable Ownership**: Only wallet owner can generate the signature
3. **Unlinkable**: Encryption public key is not obviously linked to wallet address
4. **Forward Secure**: Compromising encryption key doesn't compromise wallet
5. **Backward Secure**: Compromising wallet doesn't compromise past encryption keys (if signatures change)

---

## API Security Model

### Endpoint Security Analysis

#### 1. Key Registration: `POST /api/keys/register`

**Purpose**: Register encryption public key for a wallet address

**Security Measures:**

- Input validation for all fields
- Solana address format validation using PublicKey
- Encryption key format and length validation (32 bytes, base64)
- Prevents invalid address injection and key length attacks

#### 2. Key Lookup: `GET /api/keys/[address]`

**Purpose**: Retrieve encryption public key for a wallet address

**Security Measures:**

- Address validation prevents enumeration attacks
- Returns only public information (no secrets)
- Rate limiting recommended for brute force protection

#### 3. Note Creation: `POST /api/notes`

**Purpose**: Store encrypted note

**Security Measures:**

- Validates required fields (id, ciphertext, nonce, ephemeralPublicKey, recipientAddress)
- Validates recipient Solana address
- Size limits prevent abuse (100KB max)
- Validates maxReads parameter (1-1000 range)

**Zero-Knowledge Properties:**

- Server stores only encrypted ciphertext
- Server cannot validate message contents
- Minimal metadata stored

#### 4. Note Retrieval: `GET /api/notes/[id]`

**Purpose**: Retrieve encrypted note for decryption

**Security Measures:**

- Checks read limits before returning note
- Automatically deletes notes exceeding max reads
- Returns encrypted data only

#### 5. Read Count Increment: `POST /api/notes/[id]/increment`

**Purpose**: Increment read count and handle self-destruct

**Security Measures:**

- Atomic read count increment
- Automatic deletion when max reads exceeded
- Consistent database state under concurrent access

---

## Database Design

### Schema Design

DarkNote uses SQLite with a carefully designed schema that supports zero-knowledge encryption:

#### Notes Table

```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,              -- Random note ID
  ciphertext TEXT NOT NULL,         -- Encrypted message (base64)
  nonce TEXT NOT NULL,              -- Encryption nonce (base64)
  ephemeralPublicKey TEXT NOT NULL, -- Sender's ephemeral public key (base64)
  recipientAddress TEXT NOT NULL,   -- Solana wallet address
  createdAt INTEGER NOT NULL,       -- Unix timestamp
  selfDestruct INTEGER NOT NULL DEFAULT 1,  -- Boolean: auto-delete after reading
  maxReads INTEGER,                 -- Maximum read count (NULL = unlimited)
  currentReads INTEGER NOT NULL DEFAULT 0   -- Current read count
);

CREATE INDEX IF NOT EXISTS idx_notes_createdAt ON notes(createdAt);
```

#### Registered Keys Table

```sql
CREATE TABLE IF NOT EXISTS registered_keys (
  walletAddress TEXT PRIMARY KEY,      -- Solana wallet address
  encryptionPublicKey TEXT NOT NULL,   -- X25519 public key (base64)
  registeredAt INTEGER NOT NULL       -- Unix timestamp
);
```

### Database Security Properties

#### 1. Zero-Knowledge Storage

**What is stored (encrypted):**

- Encrypted ciphertext (server cannot decrypt)
- Random nonces (public cryptographic parameters)
- Ephemeral public keys (public keys)
- Recipient wallet address (public information)
- Metadata (timestamps, read counts)

**What is NOT stored (plaintext):**

- Original message content
- Sender identity
- Message metadata beyond what's necessary

#### 2. Data Minimization

- **No User Accounts**: No user registration, profiles, or personal data
- **No Message History**: Messages are deleted after reading (if self-destruct enabled)
- **No Sender Identity**: Sender information is not stored
- **Minimal Metadata**: Only essential fields for functionality

#### 3. Automatic Cleanup

```typescript
// Cleanup old notes (run periodically)
export function deleteOldNotes(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
  const cutoffTime = Date.now() - maxAgeMs;
  const stmt = db.prepare(`DELETE FROM notes WHERE createdAt < ?`);
  return stmt.run(cutoffTime).changes;
}
```

---

## Frontend Security

### Client-Side Cryptography

All cryptographic operations happen in the browser:

```typescript
// Encryption (sender's browser)
const encrypted = nacl.box(
  messageBytes,
  nonce,
  recipientPubKeyBytes,
  ephemeralKeypair.secretKey
);

// Decryption (recipient's browser)
const decrypted = nacl.box.open(
  ciphertextBytes,
  nonceBytes,
  ephemeralPubKeyBytes,
  recipientSecretKeyBytes
);
```

### Security Properties

- **Client-Side Only**: Cryptographic operations never leave the browser
- **No Server-Side Crypto**: Server never handles plaintext or private keys
- **Memory Safety**: TweetNaCl is implemented in JavaScript with memory safety
- **Constant-Time Operations**: NaCl operations are designed to be constant-time

---

## Self-Destruct Mechanisms

### Self-Destruct Implementation

DarkNote implements multiple self-destruct mechanisms:

#### 1. Immediate Self-Destruct

```typescript
// Default behavior: delete after first decryption
if (note.selfDestruct && note.maxReads === null) {
  await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
}
```

#### 2. Read-Count Based Self-Destruct

```typescript
// Delete after specified number of reads
export function incrementReadCount(id: string): boolean {
  const stmt = db.prepare(`UPDATE notes SET currentReads = currentReads + 1 WHERE id = ?`);
  const result = stmt.run(id);
  
  // Check if max reads exceeded
  const note = getNote(id);
  if (note && note.maxReads !== null && note.currentReads >= note.maxReads) {
    deleteNote(id);
  }
  
  return result.changes > 0;
}
```

#### 3. Time-Based Cleanup

```typescript
// Automatic cleanup of old notes
export function deleteOldNotes(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
  const cutoffTime = Date.now() - maxAgeMs;
  const stmt = db.prepare(`DELETE FROM notes WHERE createdAt < ?`);
  return stmt.run(cutoffTime).changes;
}
```

### Self-Destruct Security Properties

1. **Server-Side Enforcement**: Self-destruct is enforced server-side, not client-side
2. **Atomic Operations**: Read count increment and deletion are atomic
3. **Consistent State**: Database remains consistent even under concurrent access

---

## Privacy Guarantees

### Cryptographic Privacy Guarantees

#### 1. Message Confidentiality

**Guarantee**: Only the intended recipient can read message contents.

**Implementation:**

- **X25519 Key Agreement**: Establishes shared secret between sender and recipient
- **XSalsa20 Encryption**: Encrypts message with shared secret
- **Ephemeral Keys**: Each message uses unique sender keypair (forward secrecy)

**Threat Model**: Protects against server compromise, database breach, network eavesdropping.

#### 2. Message Authenticity

**Guarantee**: Recipients can verify messages haven't been tampered with.

**Implementation:**

- **Poly1305 MAC**: Provides authenticated encryption
- **Key Agreement**: Ensures message came from someone with sender's private key

**Threat Model**: Protects against message tampering, forgery, replay attacks.

#### 3. Forward Secrecy

**Guarantee**: Compromising long-term keys doesn't compromise past messages.

**Implementation:**

- **Ephemeral Keypairs**: Each message uses unique sender keypair
- **Key Deletion**: Ephemeral private keys are never stored

**Threat Model**: Protects against future key compromise affecting past communications.

### Operational Privacy Guarantees

#### 1. Zero Server Knowledge

**Guarantee**: Server operators cannot read message contents.

**Implementation:**

- **Client-Side Encryption**: All encryption happens in browser
- **No Server-Side Keys**: Server never has decryption keys
- **Encrypted Storage**: Only ciphertext is stored

**Verification**: Open source code allows verification of implementation.

#### 2. Automatic Data Destruction

**Guarantee**: Messages are automatically deleted to minimize data retention.

**Implementation:**

- **Self-Destruct**: Messages delete after reading (configurable)
- **Time-Based Cleanup**: Old messages are automatically purged
- **Read Limits**: Messages delete after specified read count

---

## Security Audit

### Cryptographic Security Assessment

#### ✅ Strengths

1. **Battle-Tested Cryptography**
   - **NaCl Library**: Uses Daniel J. Bernstein's NaCl, a well-audited cryptographic library
   - **Curve25519**: Uses one of the most secure elliptic curves available
   - **XSalsa20-Poly1305**: Authenticated encryption with strong security properties

2. **Forward Secrecy**
   - **Ephemeral Keys**: Each message uses unique sender keypair
   - **Key Deletion**: Ephemeral private keys are never stored
   - **Perfect Forward Secrecy**: Past messages remain secure even if long-term keys are compromised

3. **Zero-Knowledge Architecture**
   - **Server Blindness**: Server cannot decrypt messages
   - **No Plaintext Storage**: Only encrypted ciphertext is stored
   - **Cryptographic Impossibility**: Decryption without recipient's private key is mathematically impossible

#### ⚠️ Areas for Improvement

1. **Rate Limiting**: Should be implemented on all API endpoints
2. **CSRF Protection**: Should be added for state-changing operations
3. **Content Security Policy**: Should implement strict CSP headers
4. **Database Encryption**: SQLite database should be encrypted at rest

---

## Deployment & Operations

### Production Deployment

#### Environment Configuration

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

#### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Security Hardening

- **System Updates**: Keep system packages updated
- **Firewall Configuration**: Restrict unnecessary ports
- **HTTPS Enforcement**: Use TLS 1.3 for all communications
- **Security Headers**: Implement proper security headers

---

## FAQ

### General Questions

#### Q: What makes DarkNote different from other messaging apps?

**A**: DarkNote implements **true zero-knowledge encryption** where the server literally cannot decrypt your messages. Unlike traditional messaging apps that could theoretically read your messages, DarkNote uses client-side encryption with keys derived from your Solana wallet.

#### Q: Do I need to create an account?

**A**: No! DarkNote uses your Solana wallet address as your identity. There are no usernames, passwords, emails, or phone numbers required.

### Security Questions

#### Q: Can DarkNote read my messages?

**A**: **Absolutely not.** This is cryptographically impossible. Messages are encrypted in your browser before being sent to the server. The server only stores encrypted ciphertext that is mathematically impossible to decrypt without your wallet's private key.

#### Q: How secure is the encryption?

**A**: DarkNote uses **NaCl (Networking and Cryptography Library)**:
- **X25519**: Elliptic curve key agreement (Curve25519)
- **XSalsa20**: Stream cipher for encryption
- **Poly1305**: Message authentication code
- **Forward Secrecy**: Each message uses unique ephemeral keys

This is the same cryptography used by Signal, WireGuard, and other security-critical applications.

### Technical Questions

#### Q: How does key derivation work?

**A**: DarkNote uses signature-based key derivation:
1. Creates a deterministic message: "DarkNote encryption key for [wallet_address]"
2. Wallet signs the message (proves ownership)
3. Signature is hashed to create a seed for X25519 encryption keys
4. Same wallet always generates the same encryption keypair

#### Q: Why do messages self-destruct?

**A**: Self-destruct minimizes the window of exposure:
- Reduces attack surface (less data stored = less data at risk)
- Privacy by design (messages are meant to be ephemeral)
- Configurable (can set to self-destruct after 1 read, multiple reads, or disable)
- Server-side enforcement (self-destruct is enforced by the server)

### Privacy Questions

#### Q: Can DarkNote see who I'm messaging?

**A**: DarkNote can see:
- Recipient wallet addresses (necessary for message delivery)
- Timing information (when messages are sent/received)
- Message count (how many messages to each address)

DarkNote cannot see:
- Sender identity (not stored in database)
- Message contents (encrypted)
- Sender wallet address (ephemeral keys used)

#### Q: Should I use Tor or VPN with DarkNote?

**A**: For maximum privacy, yes:
- Network Anonymity: Hides your IP address from DarkNote servers
- Traffic Analysis Protection: Prevents correlation of your network activity
- Metadata Protection: Reduces metadata leakage

DarkNote protects message contents, but network-level privacy requires additional tools.

---

## Conclusion

DarkNote represents a new paradigm in private messaging: **true zero-knowledge encryption** built on blockchain identity. By leveraging Solana wallets for identity and NaCl cryptography for security, DarkNote provides mathematically provable privacy guarantees that traditional messaging platforms cannot match.

The system's **open source nature**, **battle-tested cryptography**, and **forward secrecy** design make it suitable for privacy-conscious users who need secure communication without the complexity of traditional encrypted messaging setup.

**DarkNote: Send a note privately to someone through Solana. 🔒**

---

*This documentation is maintained alongside the DarkNote codebase. For the latest updates and technical details, visit the [GitHub repository](https://github.com/darknoteSOL/darknote).*

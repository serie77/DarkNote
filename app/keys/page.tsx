'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { deriveEncryptionKeyFromSignature } from '@/lib/crypto';

export default function KeysPage() {
  const { publicKey, signMessage } = useWallet();
  const [encryptionPublicKey, setEncryptionPublicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [registered, setRegistered] = useState(false);

  const deriveKey = async () => {
    if (!publicKey || !signMessage) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { publicKey: encPubKey } = await deriveEncryptionKeyFromSignature(
        signMessage,
        publicKey.toBase58()
      );
      setEncryptionPublicKey(encPubKey);

      // Auto-register the key
      setRegistering(true);
      const response = await fetch('/api/keys/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          encryptionPublicKey: encPubKey,
        }),
      });

      if (response.ok) {
        setRegistered(true);
      }
      setRegistering(false);
    } catch (err) {
      console.error('Key derivation error:', err);
      setError('Failed to derive encryption key. Please try again.');
      setRegistering(false);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(encryptionPublicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const registerKey = async () => {
    if (!publicKey || !encryptionPublicKey) {
      return;
    }

    setRegistering(true);
    setError('');

    try {
      const response = await fetch('/api/keys/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          encryptionPublicKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to register key');
      }

      setRegistered(true);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register key');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <>
      {/* Animated Grid Background */}
      <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 w-[200%] h-[200%] animate-[gridMove_30s_linear_infinite]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="h-screen flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img
              src="/logo-monoline.svg"
              alt="DarkNote"
              className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(168,130,255,0.4)]"
            />
            <h1 className="text-5xl font-black tracking-wider" style={{ fontFamily: 'var(--font-orbitron)' }}>
              <span className="bg-gradient-to-r from-zinc-600 to-zinc-400 bg-clip-text text-transparent">
                DARK
              </span>
              <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                NOTE
              </span>
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Generate Your Encryption Key
          </p>
          <p className="text-gray-500 text-xs mt-2">
            One-time setup • Required to receive encrypted messages
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 shadow-2xl">
          {!encryptionPublicKey ? (
            <>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <h2 className="text-xl font-bold text-white">Derive Your Encryption Key</h2>
                </div>
                <p className="text-gray-400 text-xs">
                  Connect your wallet and sign a message to generate your encryption public key
                </p>
              </div>

              {/* Wallet Connect */}
              <div className="mb-5 flex justify-center">
                <WalletMultiButton />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs">
                  {error}
                </div>
              )}

              {/* Derive Button */}
              {publicKey && (
                <button
                  onClick={deriveKey}
                  disabled={loading}
                  className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Deriving key...' : 'Derive Encryption Key'}
                </button>
              )}

              {/* Info */}
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-xs">
                  Your encryption key is deterministically derived from your wallet signature. Same wallet = same key every time.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-white mb-1">Encryption Key Generated!</h2>
                <p className="text-gray-400 text-sm">Your key has been registered and you can now receive messages</p>
              </div>

              {/* Wallet Address */}
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Wallet Address</label>
                <div className="p-3 bg-black/50 border border-zinc-700 rounded-lg">
                  <p className="text-xs text-gray-300 font-mono break-all">{publicKey?.toBase58()}</p>
                </div>
              </div>

              {/* Encryption Public Key */}
              <div className="mb-5">
                <label className="block text-xs text-gray-500 mb-1">X25519 Encryption Public Key</label>
                <div className="p-3 bg-black/50 border border-zinc-700 rounded-lg">
                  <p className="text-xs text-gray-300 font-mono break-all">{encryptionPublicKey}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mb-5 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-green-300 text-sm text-center">
                  ✅ Key registered! Senders can now encrypt messages using just your wallet address.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition text-sm"
                >
                  {copied ? 'Copied!' : 'Copy Key'}
                </button>
                <Link
                  href="/"
                  className="flex-1 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition text-center text-sm"
                >
                  Create Note
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-500 text-xs">
          <Link href="/" className="hover:text-gray-400 transition">← Back to DarkNote</Link>
        </div>
      </div>
      {/* Version */}
      <div className="absolute bottom-4 right-4 group">
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-300">
          {process.env.NEXT_PUBLIC_GIT_SHA || 'dev'}
        </div>
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-nowrap">
            Shows the current deployed build SHA
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

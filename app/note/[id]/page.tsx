'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { decryptMessage, deriveEncryptionKeyFromSignature, parseEncryptedNotePayload, EncryptedNotePayload, getDisplayMessageText } from '@/lib/crypto';
import { InlineMessage } from '@/components/InlineMessage';

interface Note {
  id: string;
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
  recipientAddress: string;
  selfDestruct: boolean;
  maxReads: number | null;
  currentReads: number;
  premium: boolean;
}

export default function ViewNotePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { publicKey, signMessage } = useWallet();
  const [note, setNote] = useState<Note | null>(null);
  const [decryptedMessage, setDecryptedMessage] = useState('');
  const [decryptedPayload, setDecryptedPayload] = useState<EncryptedNotePayload | null>(null);
  const renderedMessage = getDisplayMessageText(decryptedMessage, decryptedPayload);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState('');


  useEffect(() => {
    fetchNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams.id]);

  const fetchNote = async () => {
    try {
      const response = await fetch(`/api/notes/${resolvedParams.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Note not found. It may have already been destroyed.');
        } else {
          setError('Failed to fetch note');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setNote(data);
      setLoading(false);
    } catch {
      setError('Failed to load note');
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!note || !publicKey || !signMessage) {
      return;
    }

    if (publicKey.toBase58() !== note.recipientAddress) {
      setError('This note is not for your wallet. Please connect the correct wallet.');
      return;
    }

    setDecrypting(true);
    setError('');

    try {
      const { secretKey } = await deriveEncryptionKeyFromSignature(
        signMessage,
        publicKey.toBase58()
      );

      const decrypted = decryptMessage(
        note.ciphertext,
        note.nonce,
        note.ephemeralPublicKey,
        secretKey
      );

      setDecryptedMessage(decrypted);
      setDecryptedPayload(parseEncryptedNotePayload(decrypted));

      // Increment read count after successful decryption
      try {
        const incrementResponse = await fetch(`/api/notes/${resolvedParams.id}/increment`, {
          method: 'POST',
        });

        if (incrementResponse.ok) {
          const data = await incrementResponse.json();
          // Update note state with new read count
          setNote({ ...note, currentReads: data.currentReads });
        }
      } catch (incrementErr) {
        console.error('Failed to increment read count:', incrementErr);
      }

      // Only delete immediately if self-destruct is enabled AND no maxReads is set
      // If maxReads is set, the API will handle deletion when limit is reached
      if (note.selfDestruct && note.maxReads === null) {
        try {
          await fetch(`/api/notes/${resolvedParams.id}`, {
            method: 'DELETE',
          });
        } catch (deleteErr) {
          console.error('Failed to delete note:', deleteErr);
          // Don't show error to user since message was decrypted successfully
        }
      }
    } catch (err) {
      console.error('Decryption error:', err);
      setError('Failed to decrypt message. You may not be the intended recipient or the message may be corrupted.');
    } finally {
      setDecrypting(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      </>
    );
  }

  if (error && !note) {
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
          <div className="w-full max-w-md">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <h2 className="text-lg font-bold text-white">Note Not Found</h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">{error}</p>
              <Link
                href="/"
                className="inline-block py-3 px-6 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition text-sm"
              >
                Create New Note
              </Link>
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
        {/* Header Bar - Top */}
        <div className="absolute top-4 right-4 flex items-center gap-3 animate-[fadeIn_0.6s_ease-out_1s_forwards] opacity-0">
          <WalletMultiButton />
        </div>

        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <div className="flex items-center justify-center gap-4 mb-3">
                <img
                  src="/darknote.png"
                  alt="DarkNote"
                  className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(168,130,255,0.4)]"
                />
                <h1 className="text-5xl font-black tracking-wider cursor-pointer" style={{ fontFamily: 'var(--font-orbitron)' }}>
                  <span className="bg-gradient-to-r from-zinc-600 to-zinc-400 bg-clip-text text-transparent hover:from-zinc-500 hover:to-zinc-300 transition-all">
                    DARK
                  </span>
                  <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-300 hover:to-purple-500 transition-all">
                    NOTE
                  </span>
                </h1>
              </div>
            </Link>
            <p className="text-gray-400 text-sm">
              You have received an encrypted message
            </p>

          </div>

          {/* Main Card */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-8 shadow-2xl">
            {!decryptedMessage ? (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-2">Encrypted Message</h2>
                  <p className="text-gray-400 text-sm">
                    Connect your wallet to decrypt and read this message
                  </p>
                </div>

                {/* Note Info */}
                {note && (
                  <div className="mb-6 space-y-4">
                    <div className="p-4 bg-black/50 border border-zinc-700 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Recipient Address</p>
                      <p className="text-sm text-gray-300 font-mono break-all">{note.recipientAddress}</p>
                    </div>

                    <div className="flex gap-3">
                      {note.maxReads && (
                        <div className="flex-1 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-center">
                          <p className="text-xs text-purple-400 mb-1">Read Count</p>
                          <p className="text-sm font-semibold text-purple-300">
                            {note.currentReads} / {note.maxReads}
                          </p>
                        </div>
                      )}

                      {note.selfDestruct && (
                        <div className="flex-1 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
                          <p className="text-xs text-yellow-400 mb-1">Self-Destruct</p>
                          <p className="text-sm font-semibold text-yellow-300">
                            {note.maxReads ? `After ${note.maxReads} reads` : 'On decrypt'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Wallet Connect */}
                <div className="mb-6 flex justify-center">
                  <WalletMultiButton className="!py-3 !px-6" />
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-5 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs">
                    {error}
                  </div>
                )}

                {/* Decrypt Button */}
                {publicKey && (
                  <button
                    onClick={handleDecrypt}
                    disabled={decrypting}
                    className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {decrypting ? 'Decrypting...' : 'Decrypt & Read Message'}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Decrypted Message */}
                <div className="text-center mb-4">
                  <div className="mb-3 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-lg font-bold text-white">Message Decrypted</h2>
                  </div>
                  <p className="text-gray-400 text-xs">
                    {note?.selfDestruct && (!note.maxReads || note.currentReads >= note.maxReads)
                      ? 'This message has been destroyed'
                      : 'Message successfully decrypted'}
                  </p>
                </div>

                {/* Message Content */}
                <div className="mb-5 p-6 bg-black/50 border border-zinc-700 rounded-lg min-h-[200px]">
                  <InlineMessage
                    message={renderedMessage}
                    className="text-white text-base leading-relaxed"
                    allowEmbeds={note?.premium === true}
                  />
                </div>

                {/* Actions */}
                <Link
                  href="/"
                  className="block text-center py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition text-sm"
                >
                  Create Your Own Encrypted Note
                </Link>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-gray-500 text-xs">
            <p>End-to-end encrypted • Zero-knowledge • Client-side encryption</p>
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

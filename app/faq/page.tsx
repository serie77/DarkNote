'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);


  const faqs = [
    {
      question: "What is DarkNote?",
      answer: "DarkNote is a zero-knowledge encrypted messaging platform built on Solana. We enable users to send self-destructing, encrypted messages that can only be decrypted by the intended recipient's wallet. The server never has access to your message content - all encryption and decryption happens client-side using your Solana wallet's cryptographic keys."
    },
    {
      question: "How is our encryption provably fair?",
      answer: "DarkNote uses x25519 elliptic curve cryptography with ephemeral key pairs for each message. Your encryption key is deterministically derived from your Solana wallet signature, ensuring only you can decrypt messages sent to you. The encryption happens entirely in your browser - the server only stores encrypted ciphertext, nonces, and ephemeral public keys. This zero-knowledge architecture means we mathematically cannot read your messages, making our encryption provably secure and fair."
    },
    {
      question: "Why do I need to generate a public key before I can receive messages?",
      answer: "Your encryption public key is what senders use to encrypt messages for you - it's essential for the zero-knowledge architecture. This key is deterministically derived from your Solana wallet signature, meaning only you can generate it and only you can decrypt messages encrypted with it. You only need to do this once. Without registering your public key first, senders wouldn't be able to encrypt messages in a way that only you can decrypt. Think of it like publishing a lock that only your private key can open - it enables others to send you encrypted messages without ever knowing your private key."
    },
    {
      question: "What problem are we solving?",
      answer: "Solana seems to have missed the mark so far on sending private information from person to person. Transactions aren't the only thing that should be protected. Traditional encrypted messaging platforms require trust in centralized servers, account creation, and often compromise on privacy. DarkNote solves this by leveraging blockchain wallets for identity and encryption. No accounts, no emails, no phone numbers, just wallet-to-wallet encrypted communication. Self-destruct features ensure messages don't persist forever, and our open architecture means you can verify the security yourself."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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

      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
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
                  <span className="bg-gradient-to-r from-zinc-600 to-zinc-400 bg-clip-text text-transparent hover:from-zinc-500 hover:to-zinc-300 hover:drop-shadow-[0_0_10px_rgba(161,161,170,0.5)] transition-all">
                    SHROUD
                  </span>
                  <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-300 hover:to-purple-500 hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.5)] transition-all">
                    NOTE
                  </span>
                </h1>
              </div>
            </Link>
            <h2 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-sm">
              Everything you need to know about DarkNote
            </p>
          </div>

          {/* FAQ Items */}
          <div className="space-y-4 mb-8">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-800/30 transition"
                >
                  <h3 className="text-white font-semibold text-base pr-4">{faq.question}</h3>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300 text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Back to Home */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-block py-3 px-8 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition text-sm"
            >
              Back to Home
            </Link>
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

'use client';

import { useState } from 'react';
import Link from 'next/link';

const SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      { id: 'what-is-darknote', label: 'What is DarkNote?' },
      { id: 'how-it-works', label: 'How It Works' },
      { id: 'quick-start', label: 'Quick Start Guide' },
    ],
  },
  {
    title: 'Encryption',
    items: [
      { id: 'x25519-overview', label: 'x25519 Cryptography' },
      { id: 'zero-knowledge', label: 'Zero-Knowledge Architecture' },
      { id: 'key-derivation', label: 'Key Derivation from Wallet' },
    ],
  },
  {
    title: 'Features',
    items: [
      { id: 'self-destruct', label: 'Self-Destructing Notes' },
      { id: 'wallet-integration', label: 'Wallet Integration' },
    ],
  },
  {
        title: 'Security',
    items: [
      { id: 'threat-model', label: 'Threat Model' },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('what-is-darknote');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <style>{`
        .docs-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .docs-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .docs-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(120, 113, 108, 0.3);
          border-radius: 3px;
        }
        .docs-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 130, 255, 0.4);
        }
        .docs-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(120, 113, 108, 0.3) transparent;
        }
      `}</style>
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

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-zinc-900/80 backdrop-blur-xl border border-zinc-700 rounded-lg p-2 text-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-h-screen flex">
        <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800 z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-6">
            <Link href="/" className="flex items-center gap-3 mb-8">
              <img src="/darknote.png" alt="DarkNote" className="w-8 h-8 object-contain" />
              <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-orbitron)' }}>
                DOCS
              </span>
            </Link>

            <nav className="space-y-6">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => scrollTo(item.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition ${
                            activeSection === item.id
                              ? 'bg-purple-500/10 text-purple-300 font-medium'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-zinc-800/50'
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

                <main className="flex-1 min-w-0 overflow-y-auto h-screen docs-scrollbar">
                  <div className="px-6 py-12 lg:px-16 lg:py-16">
            <div className="mb-12">
              <h1 className="text-4xl font-black text-white mb-3" style={{ fontFamily: 'var(--font-orbitron)' }}>
                DarkNote Documentation
              </h1>
              <p className="text-gray-400 text-sm">
                Zero-knowledge encrypted messaging on Solana. Everything you need to know.
              </p>
            </div>

            <div className="space-y-20">
              <section id="what-is-darknote" className="scroll-mt-20">
                <SectionHeader icon="info" title="What is DarkNote?" />
                                <p className="text-gray-300 leading-relaxed mb-4 text-base">
                  DarkNote is a zero-knowledge encrypted messaging platform built natively on Solana. 
                  It enables anyone to send private, self-destructing messages to any Solana wallet address 
                  without requiring phone numbers, emails, or centralized accounts.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  The core idea is simple: use your existing Solana wallet as both your identity and your 
                  encryption key. No new accounts. No trusting us with your data. The server stores nothing 
                  but unreadable ciphertext.
                </p>
              </section>

              <section id="how-it-works" className="scroll-mt-20">
                <SectionHeader icon="flask" title="How It Works" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <StepCard
                    number={1}
                    title="Register Your Key"
                    description="Connect your wallet once to generate a one-time encryption public key."
                  />
                  <StepCard
                    number={2}
                    title="Send Encrypted Messages"
                    description="Enter any Solana address, write your message, and we encrypt it client-side."
                  />
                  <StepCard
                    number={3}
                    title="Decrypt & Read"
                    description="The recipient connects their wallet to derive the private key and decrypt."
                  />
                </div>
              </section>

              <section id="quick-start" className="scroll-mt-20">
                <SectionHeader icon="bolt" title="Quick Start Guide" />
                <div className="space-y-4 mt-6">
                  <StepBlock step={1} title="Connect Your Wallet" description="Click the wallet button in the top right and connect with Phantom, Solflare, or any supported wallet." />
                  <StepBlock step={2} title="Generate Your Encryption Key (One-Time)" description="If this is your first time, you'll see a yellow banner asking you to generate your encryption key. Click the button and sign the message in your wallet." note="This is a one-time setup. Once done, anyone can send you encrypted messages." />
                  <StepBlock step={3} title="Send a Message" description="Enter the recipient's Solana address, write your secret message, and optionally enable self-destruct." code={`1. Paste recipient address
2. Type your message
3. (Optional) Enable Self-Destruct
4. Click "Create Encrypted Note"`} />
                  <StepBlock step={4} title="Share the Link" description="Copy the generated link and send it to the recipient via any channel. Only their wallet can decrypt it." />
                </div>
              </section>

              <section id="x25519-overview" className="scroll-mt-20">
                <SectionHeader icon="lock" title="x25519 Cryptography" />
                <p className="text-gray-300 leading-relaxed mb-4">
                  DarkNote uses x25519 elliptic-curve Diffie-Hellman on Curve25519, the same curve used by Signal, WireGuard, and SSH.
                </p>
                <div className="space-y-4 mt-6">
                  <DetailRow label="A" title="Ephemeral Key Pair">Every message generates a fresh ephemeral x25519 key pair. The ephemeral public key is stored on the server; the private key is discarded after encryption.</DetailRow>
                  <DetailRow label="B" title="Shared Secret">The sender uses ECDH with their ephemeral private key and the recipient&apos;s public key to derive a shared secret.</DetailRow>
                  <DetailRow label="C" title="XSalsa20-Poly1305">The shared secret encrypts the message with XSalsa20 and authenticates with Poly1305 MAC &mdash; same as libsodium.</DetailRow>
                </div>
              </section>

              <section id="zero-knowledge" className="scroll-mt-20">
                <SectionHeader icon="shield" title="Zero-Knowledge Architecture" />
                <p className="text-gray-300 leading-relaxed mb-4">
                  The server mathematically cannot read your messages. Here&apos;s the proof:
                </p>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 space-y-3">
                  <ProofItem label="Server stores:" value="Encrypted ciphertext, nonce, ephemeral public key" />
                  <ProofItem label="Server never sees:" value="Your plaintext, your private key, your wallet signature" />
                  <ProofItem label="Client does:" value="Encrypts in browser, decrypts in browser, derives keys locally" />
                </div>
              </section>

              <section id="key-derivation" className="scroll-mt-20">
                <SectionHeader icon="key" title="Key Derivation from Wallet" />
                <p className="text-gray-300 leading-relaxed mb-4">
                  Your encryption key pair is deterministically derived from a wallet signature on a fixed message.
                </p>
                <div className="bg-black/50 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-gray-400">
                  <div className="text-gray-500 mb-1"># Derivation flow</div>
                  <div>wallet.signMessage(&quot;darknote-key-registration&quot;)</div>
                  <div className="text-purple-400">  &darr;</div>
                  <div>ed25519_signature</div>
                  <div className="text-purple-400">  &darr;</div>
                  <div>SHA-256 hash</div>
                  <div className="text-purple-400">  &darr;</div>
                  <div>clamped x25519 private key</div>
                  <div className="text-purple-400">  &darr;</div>
                  <div>x25519 public key (published)</div>
                </div>
              </section>

              <section id="self-destruct" className="scroll-mt-20">
                <SectionHeader icon="fire" title="Self-Destructing Notes" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <h4 className="text-white font-semibold text-sm mb-2">One-Time Read</h4>
                    <p className="text-gray-400 text-sm">Default. Self-destructs immediately after first decryption. Perfect for seed phrases or private keys.</p>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <h4 className="text-white font-semibold text-sm mb-2">Custom Read Limit</h4>
                    <p className="text-gray-400 text-sm">Set any number of reads. Useful if the recipient might need to re-read the message.</p>
                  </div>
                </div>
              </section>

              <section id="wallet-integration" className="scroll-mt-20">
                <SectionHeader icon="wallet" title="Wallet Integration" />
                <p className="text-gray-300 leading-relaxed mb-4">
                  DarkNote supports any Solana wallet via the wallet-adapter standard. Currently tested with:
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Phantom', 'Solflare', 'Backpack', 'Glow', 'Ledger'].map((w) => (
                    <span key={w} className="px-3 py-1 bg-zinc-900/50 border border-zinc-800 rounded-md text-xs text-gray-300">
                      {w}
                    </span>
                  ))}
                </div>
              </section>

                            <section id="threat-model" className="scroll-mt-20">
                <SectionHeader icon="eye-off" title="Threat Model" />
                <div className="space-y-3">
                  <ThreatRow attacker="Compromised server" outcome="Messages are encrypted. Server only stores ciphertext, nonces, and ephemeral public keys. No decryption possible." />
                  <ThreatRow attacker="Network eavesdropper" outcome="All traffic is HTTPS. The note link contains only the note ID, with no decryption key in the URL." />
                  <ThreatRow attacker="Recipient's device" outcome="Once decrypted, the plaintext is in the recipient's browser. We can't control their device." />
                  <ThreatRow attacker="Sender's device" outcome="The plaintext exists on the sender's device before encryption. Standard endpoint security applies." />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const icons: Record<string, React.ReactNode> = {
    info: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    flask: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />,
    bolt: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    lock: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
    key: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
    fire: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />,
    wallet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    'eye-off': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />,
    code: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
  };
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icons[icon]}
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-orbitron)' }}>
        {title}
      </h2>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
        <span className="text-sm font-bold text-gray-400">{number}</span>
      </div>
      <h3 className="text-white font-semibold mb-2 text-sm">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepBlock({ step, title, description, note, code }: { step: number; title: string; description: string; note?: string; code?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
      <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
        <span className="text-purple-400 font-mono text-xs">Step {step}</span>
        {title}
      </h3>
      <p className="text-gray-400 text-base leading-relaxed mb-3">{description}</p>
      {note && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mb-3">
          <p className="text-yellow-300 text-xs">{note}</p>
        </div>
      )}
      {code && (
        <div className="bg-black/50 rounded-md p-3 font-mono text-xs text-gray-500 whitespace-pre-line">
          {code}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
        <span className="text-[10px] font-bold text-purple-400">{label}</span>
      </div>
      <div>
        <p className="text-white text-sm font-medium mb-1">{title}</p>
        <p className="text-gray-400 text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-purple-400 font-mono text-xs mt-0.5">&rarr;</span>
      <div>
        <span className="text-gray-500 text-xs">{label}</span>
        <span className="text-gray-300 text-sm ml-2">{value}</span>
      </div>
    </div>
  );
}

function ThreatRow({ attacker, outcome }: { attacker: string; outcome: string }) {
  return (
    <div className="flex items-start gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <span className="text-red-400 font-mono text-xs mt-0.5">ATTACKER</span>
      <div className="flex-1">
        <p className="text-white text-sm font-medium">{attacker}</p>
        <p className="text-gray-400 text-sm mt-1">{outcome}</p>
      </div>
    </div>
  );
}

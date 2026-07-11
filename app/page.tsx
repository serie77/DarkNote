'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { encryptMessage, generateNoteId, deriveEncryptionKeyFromSignature, parseInlineMessageParts } from '@/lib/crypto';
import { InlineMessage } from '@/components/InlineMessage';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// Steps in the gift delivery flow, in order.
type GiftStep =
  | 'idle'
  | 'creating-order'
  | 'awaiting-approval'
  | 'confirming'
  | 'delivering'
  | 'delivered'
  | 'failed';

const GIFT_STEPS: { key: GiftStep; label: string; hint: string }[] = [
  { key: 'creating-order', label: 'Creating order', hint: 'Setting up the transfer with SplitNow' },
  { key: 'awaiting-approval', label: 'Approve in wallet', hint: 'Confirm the transaction in your wallet' },
  { key: 'confirming', label: 'Confirming on-chain', hint: 'Waiting for Solana to confirm your deposit' },
  { key: 'delivering', label: 'Delivering via SplitNow', hint: 'SplitNow is forwarding SOL to the recipient' },
  { key: 'delivered', label: 'Gift delivered', hint: 'Funds have reached the recipient' },
];
const FREE_MESSAGE_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 10000; // premium (x402) raises the free 2,000-char limit
const GIF_LIKE = /(https?:\/\/\S+\.(?:gif|png|jpe?g|webp))|tenor\.com|giphy\.com/i;
const EMOTE_SECTIONS = [
  {
    label: 'Smileys',
    items: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴'],
  },
  {
    label: 'Mood',
    items: ['😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿'],
  },
  {
    label: 'Gestures',
    items: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '💪'],
  },
  {
    label: 'People',
    items: ['👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '🧑‍💻', '🧑‍🎨', '🧑‍🚀', '🧑‍⚕️', '🧑‍🔬', '🧑‍🍳', '🧑‍🎤', '🕵️', '🥷', '👮', '👷', '💂', '🧙', '🧛', '🧟', '🧞', '🧜', '🧚'],
  },
  {
    label: 'Hearts',
    items: ['💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤'],
  },
  {
    label: 'Animals',
    items: ['🐵', '🐒', '🦍', '🦧', '🐶', '🐕', '🐩', '🐺', '🦊', '🦝', '🐱', '🐈', '🦁', '🐯', '🐅', '🐆', '🐴', '🫎', '🫏', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂', '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑', '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦣', '🦏', '🦛', '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦫'],
  },
  {
    label: 'Nature',
    items: ['🦔', '🦇', '🐻', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾', '🦃', '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊️', '🦅', '🦆', '🦢', '🦉', '🦤', '🪶', '🦩', '🦚', '🦜', '🐸', '🐊', '🐢', '🦎', '🐍', '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🦭', '🐟', '🐠', '🐡', '🦈', '🐙', '🐚', '🪸', '🪼'],
  },
  {
    label: 'Food',
    items: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🫛', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔'],
  },
  {
    label: 'Drink',
    items: ['🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🫘', '🍯', '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'],
  },
  {
    label: 'Travel',
    items: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🚀', '🛸', '🚁'],
  },
  {
    label: 'Places',
    items: ['🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '♨️', '🎠', '🛝', '🎡', '🎢', '💈', '🎪'],
  },
  {
    label: 'Activities',
    items: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗'],
  },
  {
    label: 'Objects',
    items: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🪫', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵'],
  },
  {
    label: 'Tools',
    items: ['💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '🪬', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸'],
  },
  {
    label: 'Symbols',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❌', '⭕', '✅', '☑️', '✔️', '✖️', '➕', '➖', '➗', '➰', '➿', '〽️', '✳️', '✴️', '❇️', '‼️', '⁉️', '❓', '❔', '❕', '❗', '〰️', '©️', '®️', '™️', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔒', '🔓'],
  },
  {
    label: 'Text',
    items: [':)', ':-)', ':D', ':-D', ';)', ';-)', ':P', ':-P', 'XD', 'xD', '<3', 'o/', ':3', ':-3', '>:)', '>:D', '8)', ':-O', ':o', 'T_T', ':/', ':-/', '>:(', 'D:', 'x_x', '._.'],
  },
  {
    label: 'Kaomoji',
    items: ['¯\\_(ツ)_/¯', '( ͡° ͜ʖ ͡°)', '(╯°□°）╯︵ ┻━┻', '┬─┬ ノ( ゜-゜ノ)', '(ง •̀_•́)ง', '(•̀ᴗ•́)و', '(｡•̀ᴗ-)✧', '(づ｡◕‿‿◕｡)づ', '(っ◕‿◕)っ', '(￣▽￣)', '(＾▽＾)', '(；一_一)', '(◕‿◕✿)', '(≧◡≦)', '(⌐■_■)', '(ಥ﹏ಥ)', '(งツ)ง', '(ʘ‿ʘ)', '(ノಠ益ಠ)ノ', '(◠‿◠)', '(•_•)', '(•‿•)', '(°ロ°)☝', '(ꈍᴗꈍ)', '(ノ◕ヮ◕)ノ*:･ﾟ✧'],
  },
] as const;
const EMOTE_TOTAL = EMOTE_SECTIONS.reduce((total, section) => total + section.items.length, 0);
function stepIndex(step: GiftStep): number {
  return GIFT_STEPS.findIndex((s) => s.key === step);
}

function GiftProgress({ step, elapsedSec }: { step: GiftStep; elapsedSec: number }) {
  const activeIndex = stepIndex(step);
  const failed = step === 'failed';
  const done = step === 'delivered';

  return (
    <div className="mb-5 p-4 bg-purple-500/5 border border-purple-500/30 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-purple-300 flex items-center gap-2">
          <span>🎁</span>
          {failed ? 'Gift failed' : done ? 'Gift delivered!' : 'Sending your SOL gift'}
        </span>
        {step === 'delivering' && (
          <span className="text-[10px] font-mono text-purple-400/70 tabular-nums">
            {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {GIFT_STEPS.map((s, i) => {
          const isComplete = done ? true : i < activeIndex;
          const isActive = !failed && !done && i === activeIndex;
          const isFailedHere = failed && i === activeIndex;
          return (
            <div key={s.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    isComplete
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : isFailedHere
                      ? 'bg-red-500/20 border-red-500 text-red-400'
                      : isActive
                      ? 'bg-purple-500/20 border-purple-400'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isFailedHere ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isActive ? (
                    <svg className="w-3 h-3 animate-spin text-purple-300" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>
                {i < GIFT_STEPS.length - 1 && (
                  <div
                    className={`w-px h-5 mt-1 transition-colors duration-300 ${
                      isComplete ? 'bg-green-500/40' : 'bg-zinc-700'
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 -mt-0.5">
                <p
                  className={`text-xs font-medium transition-colors ${
                    isComplete
                      ? 'text-green-400'
                      : isFailedHere
                      ? 'text-red-400'
                      : isActive
                      ? 'text-purple-200'
                      : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </p>
                {isActive && (
                  <p className="text-[11px] text-gray-500 mt-0.5">{s.hint}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {step === 'delivering' && (
        <div className="mt-4">
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[giftSlide_1.5s_ease-in-out_infinite] rounded-full" />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 text-center">
            This can take a minute or two - please keep this tab open.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, signMessage, connected, sendTransaction } = useWallet();
  const [message, setMessage] = useState('');
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [emoteCategoryOpen, setEmoteCategoryOpen] = useState(false);
  const [emoteSection, setEmoteSection] = useState<(typeof EMOTE_SECTIONS)[number]['label']>(EMOTE_SECTIONS[0].label);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emoteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [emotePanelPosition, setEmotePanelPosition] = useState({ top: 0, left: 0 });
  const [recipientAddress, setRecipientAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [noteUrl, setNoteUrl] = useState('');
  const [error, setError] = useState('');
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [maxReads, setMaxReads] = useState<number | null>(null);
  const [guaranteedRetention, setGuaranteedRetention] = useState(false);
  const [payModal, setPayModal] = useState<{
    terms: { nonce: string; amount: number; network: string; asset: string; payTo: string };
    noteId: string;
    notePayload: Record<string, unknown>;
  } | null>(null);
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [giftEnabled, setGiftEnabled] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftStep, setGiftStep] = useState<GiftStep>('idle');
  const [giftElapsed, setGiftElapsed] = useState(0);
  const giftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsupportedEmbedLinks = useMemo(
    () => parseInlineMessageParts(message).filter((part) => part.kind === 'link'),
    [message]
  );

  const positionEmotePanel = useCallback(() => {
    const button = emoteButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 320;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.right - panelWidth, margin),
      window.innerWidth - panelWidth - margin
    );
    const top = Math.min(
      Math.max(rect.bottom + 8, margin),
      window.innerHeight - panelHeight - margin
    );

    setEmotePanelPosition({ top, left });
  }, []);

  const insertEmote = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((current) => {
        const needsSpace = current.length > 0 && !/\s$/.test(current);
        return `${current}${needsSpace ? ' ' : ''}${emoji}`;
      });
      setEmoteOpen(false);
      setEmoteCategoryOpen(false);
      return;
    }

    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}${emoji}${message.slice(end)}`;
    setMessage(next);
    setEmoteOpen(false);
    setEmoteCategoryOpen(false);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + emoji.length;
      textarea.setSelectionRange(caret, caret);
    });
  }, [message]);

  useEffect(() => {
    if (!emoteOpen) return;

    positionEmotePanel();
    window.addEventListener('resize', positionEmotePanel);
    window.addEventListener('scroll', positionEmotePanel, true);

    return () => {
      window.removeEventListener('resize', positionEmotePanel);
      window.removeEventListener('scroll', positionEmotePanel, true);
    };
  }, [emoteOpen, positionEmotePanel]);

  const checkForEncryptionKey = async () => {
    if (!publicKey) return;

    setCheckingKey(true);
    try {
      const response = await fetch(`/api/keys/${publicKey.toBase58()}`);
      setHasEncryptionKey(response.ok);
    } catch {
      setHasEncryptionKey(false);
    } finally {
      setCheckingKey(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      checkForEncryptionKey();
    } else {
      setHasEncryptionKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);
  const handleRegisterKey = async () => {
    if (!publicKey || !signMessage) return;

    setCheckingKey(true);
    try {
      const { publicKey: encPubKey } = await deriveEncryptionKeyFromSignature(
        signMessage,
        publicKey.toBase58()
      );

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
        setHasEncryptionKey(true);
      } else {
        throw new Error('Failed to register key');
      }
    } catch (err) {
      console.error('Key registration error:', err);
      alert('Failed to register encryption key. Please try again.');
    } finally {
      setCheckingKey(false);
    }
  };






    // Run the elapsed timer only while we're actively delivering via SplitNow.
    useEffect(() => {
      if (giftStep === 'delivering') {
        setGiftElapsed(0);
        giftTimerRef.current = setInterval(() => {
          setGiftElapsed((s) => s + 1);
        }, 1000);
      } else if (giftTimerRef.current) {
        clearInterval(giftTimerRef.current);
        giftTimerRef.current = null;
      }
      return () => {
        if (giftTimerRef.current) {
          clearInterval(giftTimerRef.current);
          giftTimerRef.current = null;
        }
      };
    }, [giftStep]);

    // Result of polling SplitNow order status
    type GiftPollResult =
      | { status: 'completed' }
      | { status: 'failed' }
      | { status: 'timeout' };

    // Poll SplitNow order status until the funds are actually sent (or it fails/times out)
  const pollGiftStatus = useCallback(async (orderId: string): Promise<GiftPollResult> => {
    const maxAttempts = 120; // 10 minutes max (every 5s)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/gift/status?orderId=${orderId}`);
        if (!res.ok) continue;
                const data = await res.json();
        // Use statusShort per SplitNow spec. Terminal values: completed | expired | halted | failed | refunded
        if (data.status === 'completed') {
          return { status: 'completed' };
        }
        if (data.status === 'failed') {
          return { status: 'failed' };
        }
        // data.status === 'processing' or anything else - keep polling
      } catch {
        // transient error - keep polling
      }
    }
    return { status: 'timeout' };
  }, []);





  const hasGifLink = GIF_LIKE.test(message);
  // A note is premium (and needs an x402 payment) if it exceeds the free
  // message length, attaches a GIF, is multi-read, or asks for guaranteed
  // retention.
  const isPremiumNote =
    guaranteedRetention ||
    (selfDestruct && (maxReads ?? 1) > 1) ||
    message.length > FREE_MESSAGE_LENGTH ||
    hasGifLink;

  const premiumReasons = [
    message.length > FREE_MESSAGE_LENGTH ? 'long message' : null,
    hasGifLink ? 'GIF attached' : null,
    selfDestruct && (maxReads ?? 1) > 1 ? 'multi-read' : null,
    guaranteedRetention ? 'guaranteed retention' : null,
  ].filter(Boolean);
  const premiumReasonText = premiumReasons.length ? `Includes ${premiumReasons.join(', ')}.` : '';

  const postNote = (payload: Record<string, unknown>, paymentHeader?: string) =>
    fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(paymentHeader ? { 'X-PAYMENT': paymentHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

  // Build an x402 payment payload. Shaped to mirror a real x402 payment so
  // swapping the mock facilitator for a live one needs no restructuring: the
  // demo marks the payment valid; a production build replaces `authorization`
  // and `valid` with a wallet-signed USDC transfer.
  const buildX402Payment = (terms: { nonce: string; amount: number; network: string }) =>
    btoa(
      JSON.stringify({
        x402Version: 1,
        scheme: 'exact',
        network: terms.network,
        payload: { nonce: terms.nonce, payer: publicKey?.toBase58(), authorization: 'mock' },
        nonce: terms.nonce,
        amount: terms.amount,
        payer: publicKey?.toBase58(),
        valid: true,
      })
    );

  const finishNote = (noteId: string) => {
    setNoteUrl(`${window.location.origin}/note/${noteId}`);
    setMessage('');
    setEmoteOpen(false);
    setEmoteSection(EMOTE_SECTIONS[0].label);
    setRecipientAddress('');
    setGuaranteedRetention(false);
    setSelfDestruct(false);
    setMaxReads(null);
    setGiftAmount('');
    setGiftEnabled(false);
    setGiftStep('idle');
    setPayModal(null);
  };

  const payAndComplete = async () => {
    if (!payModal) return;
    setLoading(true);
    setError('');
    try {
      const res = await postNote(payModal.notePayload, buildX402Payment(payModal.terms));
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Payment could not be completed');
      }
      finishNote(payModal.noteId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment could not be completed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    setError('');
    setNoteUrl('');
    setGiftStep('idle');

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    if (!recipientAddress.trim()) {
      setError('Please enter a recipient address');
      return;
    }

    try {
      new PublicKey(recipientAddress);
    } catch {
      setError('Invalid Solana address');
      return;
    }

    // Gift requires wallet connection
    if (giftEnabled && (!connected || !publicKey || !sendTransaction)) {
      setError('Connect your wallet to send a SOL gift');
      return;
    }

    const parsedGiftAmount = giftEnabled ? parseFloat(giftAmount) : 0;
    if (giftEnabled && (isNaN(parsedGiftAmount) || parsedGiftAmount <= 0)) {
      setError('Enter a valid SOL amount for the gift');
      return;
    }

    setLoading(true);

    try {
      let x25519PublicKey: string;

      try {
        const keyResponse = await fetch(`/api/keys/${recipientAddress}`);

        if (keyResponse.ok) {
          const keyData = await keyResponse.json();
          x25519PublicKey = keyData.encryptionPublicKey;
        } else {
          setError(
            `Recipient hasn't registered their encryption key yet. Ask them to visit ${window.location.origin}/keys to register.`
          );
          setLoading(false);
          return;
        }
      } catch {
        setError('Failed to look up recipient encryption key');
        setLoading(false);
        return;
      }

      // Handle gift flow if enabled
      let giftTxSignature: string | null = null;
      let giftAmountSol: number | null = null;



            if (giftEnabled && parsedGiftAmount > 0 && publicKey && sendTransaction) {
        setGiftStep('creating-order');

        try {
          // Step 1: Create quote + order via our API
          const giftRes = await fetch('/api/gift', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientAddress,
              amountSol: parsedGiftAmount,
            }),
          });

          if (!giftRes.ok) {
            const giftErr = await giftRes.json();
            throw new Error(giftErr.error || 'Failed to create gift order');
          }

          const giftData = await giftRes.json();



                    // Step 2: Send SOL to SplitNow deposit address
          setGiftStep('awaiting-approval');
          const depositPubkey = new PublicKey(giftData.depositAddress);

                    const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: depositPubkey,
              lamports: Math.round(parsedGiftAmount * LAMPORTS_PER_SOL),
            })
          );

          // Fetch the blockhash + lastValidBlockHeight as late as possible (right
          // before sending) so it doesn't expire while the user reviews the wallet
          // prompt. We use 'finalized' to get a stable, widely-propagated blockhash
          // which avoids "Blockhash not found" on RPCs that lag behind.
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash('finalized');
          transaction.recentBlockhash = blockhash;
          transaction.lastValidBlockHeight = lastValidBlockHeight;
          transaction.feePayer = publicKey;



                                        const txSig = await sendTransaction(transaction, connection);
          setGiftStep('confirming');

          // Confirm the deposit tx actually landed on-chain.
          // confirmTransaction can throw TransactionExpiredBlockheightExceededError
          // even when the tx landed fine - the watcher just timed out. So we catch
          // that and fall back to getSignatureStatuses to check directly.
          let txLanded = false;
          try {
            const confirmation = await connection.confirmTransaction(
              { signature: txSig, blockhash, lastValidBlockHeight },
              'confirmed'
            );
            txLanded = !confirmation.value.err;
          } catch (confirmErr) {
            // confirmTransaction threw - likely block height exceeded.
            // Check if the tx actually landed anyway.
            console.warn('confirmTransaction threw, checking signature status directly:', confirmErr);
            for (let retry = 0; retry < 5; retry++) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const statusResp = await connection.getSignatureStatuses([txSig]);
                const status = statusResp?.value?.[0];
                if (status && status.confirmationStatus && !status.err) {
                  txLanded = true;
                  break;
                }
                if (status?.err) {
                  break; // genuinely failed on-chain
                }
              } catch {
                // RPC hiccup, keep retrying
              }
            }
          }

          if (!txLanded) {
            throw new Error(
              'Deposit transaction could not be confirmed on-chain. ' +
              'Check your wallet - if SOL was deducted the transfer may still process. ' +
              `Tx: ${txSig}`
            );
          }
          setGiftStep('delivering');

          // Step 3: Wait for SplitNow to actually forward the funds to the
          // recipient BEFORE we create the note. This prevents the race where the
          // message claims a gift was delivered while SplitNow is still processing
          // (or ends up failing).
          const pollResult = await pollGiftStatus(giftData.orderId);






                    if (pollResult.status === 'completed') {
                      giftTxSignature = txSig; // We already have the tx sig from the deposit
                      giftAmountSol = parsedGiftAmount;
                      setGiftStep('delivered');
                    } else if (pollResult.status === 'failed') {
            setGiftStep('failed');
            throw new Error(
              'SplitNow could not deliver the gift. Your deposit was received but ' +
                'not forwarded - please contact support with order ' +
                `${giftData.orderId} before resending.`
            );



                    } else {
            setGiftStep('failed');
            // Timed out waiting for delivery - do NOT create the note, to avoid a
            // race where the recipient sees a gift that hasn't actually arrived.
            throw new Error(
              'Timed out waiting for SplitNow to deliver the gift (order ' +
                `${giftData.orderId}). The funds may still arrive shortly. ` +
                'Please check the order status before resending to avoid double-paying.'
            );
          }
        } catch (giftErr) {
          console.error('Gift error:', giftErr);
          setError(`Gift failed: ${giftErr instanceof Error ? giftErr.message : 'Unknown error'}`);
          setLoading(false);
          return;
        }
      }

      const encrypted = encryptMessage(message, x25519PublicKey);
      const noteId = generateNoteId();

      const notePayload = {
        id: noteId,
        ...encrypted,
        recipientAddress,
        selfDestruct,
        maxReads,
        guaranteedRetention,
        premiumRequested: isPremiumNote,
        giftAmountSol,
        giftTxSignature,
      };

      const response = await postNote(notePayload);

      // Premium notes require an x402 micropayment. Rather than pay silently,
      // surface the x402 terms so the sender completes payment explicitly.
      if (response.status === 402) {
        const terms = (await response.json())?.accepts?.[0];
        if (terms) {
          setPayModal({ terms, noteId, notePayload });
          setLoading(false);
          return;
        }
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create note');
      }

      finishNote(noteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(noteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emotePanel = emoteOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed z-[2147483647] w-[20rem] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/70"
          style={{ top: emotePanelPosition.top, left: emotePanelPosition.left }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Emotes</p>
              <p className="text-[10px] text-zinc-600">{EMOTE_TOTAL} available</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmoteCategoryOpen((current) => !current)}
                className="flex h-8 min-w-32 items-center justify-between gap-2 rounded-md border border-zinc-700 bg-black/60 px-2.5 text-[11px] text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                aria-label="Emoji category"
              >
                <span>{emoteSection}</span>
                <svg className={`h-3 w-3 transition ${emoteCategoryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {emoteCategoryOpen && (
                <div className="absolute right-0 top-9 z-[2147483647] w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl shadow-black/50">
                  <div className="max-h-52 overflow-y-auto p-1">
                    {EMOTE_SECTIONS.map((section) => (
                      <button
                        key={section.label}
                        type="button"
                        onClick={() => {
                          setEmoteSection(section.label);
                          setEmoteCategoryOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[11px] transition ${
                          emoteSection === section.label
                            ? 'bg-purple-500/15 text-purple-200'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                        }`}
                      >
                        <span>{section.label}</span>
                        <span className="text-zinc-600">{section.items.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-2">
            <div className="grid grid-cols-8 gap-1">
              {(EMOTE_SECTIONS.find((section) => section.label === emoteSection)?.items ?? []).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmote(emoji)}
                  className="h-8 rounded-md border border-transparent bg-zinc-900/70 text-base leading-none text-gray-200 transition hover:border-purple-400/60 hover:bg-purple-500/10 hover:text-white"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {emotePanel}
      {/* Animated Grid Background - Homepage only */}
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

      <div className="h-screen p-4 overflow-hidden">
        {/* Header Bar - Top */}
        <div className="absolute top-4 right-4 flex items-center gap-3 animate-[fadeIn_0.6s_ease-out_1s_forwards] opacity-0">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 backdrop-blur-xl px-4 py-2 shadow-lg shadow-black/20">
            <button
              onClick={() => {
                navigator.clipboard.writeText('notej5xmjxdvVUrdaLKCAu78thXGzBNkYF3HCcfqREf');
              }}
              className="flex items-center gap-3 transition hover:opacity-80"
              title="Click to copy"
            >
              <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">CA</span>
              <span className="font-mono text-sm text-gray-100">notej5xmjxdvVUrdaLKCAu78thXGzBNkYF3HCcfqREf</span>
            </button>
          </div>
          <WalletMultiButton />
        </div>

        <div className="flex items-center justify-center h-screen">
          <div className="w-full max-w-2xl animate-fadeIn">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <img
                  src="/darknote.png"
                  alt="DarkNote"
                  className="w-14 h-14 object-contain filter drop-shadow-[0_0_8px_rgba(168,130,255,0.4)]"
                />
                <h1 className="text-6xl font-black tracking-wider" style={{ fontFamily: 'var(--font-orbitron)' }}>
                  <span className="bg-gradient-to-r from-zinc-600 to-zinc-400 bg-clip-text text-transparent hover:from-zinc-500 hover:to-zinc-300 hover:drop-shadow-[0_0_10px_rgba(161,161,170,0.5)] transition-all cursor-pointer">
                    SHROUD
                  </span>
                  <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-300 hover:to-purple-500 hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.5)] transition-all cursor-pointer">
                    NOTE
                  </span>
                </h1>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Send a private note to anyone on Solana.
              </p>

              {/* Links */}
              <div className="flex items-center justify-center gap-4">
                <span className="text-gray-700">•</span>
                                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Docs</span>
                </Link>
                <span className="text-gray-700">•</span>
                <a
                  href="/faq"
                  className="text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  FAQ
                </a>
              </div>
            </div>

          {/* Wallet Connection & Key Status */}
          {connected && (
            <div className="mb-6">
              {checkingKey ? (
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">Checking encryption key...</p>
                </div>
              ) : hasEncryptionKey === false ? (
                <div className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-yellow-400 text-sm font-medium mb-1">One-time setup required</p>
                      <p className="text-yellow-300/80 text-xs mb-3">
                        To receive encrypted messages, you need to generate a one-time public key.
                        This is crucial for zero-knowledge encryption and only needs to be done once.
                      </p>
                      <button
                        onClick={handleRegisterKey}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs font-medium rounded-md transition"
                      >
                        Generate Encryption Key
                      </button>
                    </div>
                  </div>
                </div>
              ) : hasEncryptionKey === true ? (
                <div className="bg-green-500/10 backdrop-blur-xl border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-400 text-sm">Encryption key registered • Ready to receive messages</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Main Card */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 shadow-2xl">
            {!noteUrl ? (
              <>

                {/* Recipient Address */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Recipient Solana Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana wallet address..."
                    className="w-full px-4 py-3 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 font-mono text-sm transition"
                  />
                </div>

                {/* Message */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Secret Message
                  </label>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      placeholder="Write your encrypted message..."
                      rows={6}
                      maxLength={MAX_MESSAGE_LENGTH}
                      className="w-full px-4 py-3 pr-32 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none transition text-sm"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <p className={`text-[11px] tabular-nums ${message.length > FREE_MESSAGE_LENGTH ? 'text-purple-300' : 'text-gray-500'}`}>
                        {message.length}/{message.length > FREE_MESSAGE_LENGTH ? MAX_MESSAGE_LENGTH : FREE_MESSAGE_LENGTH}
                      </p>
                      <div className="relative">
                        <button
                          ref={emoteButtonRef}
                          type="button"
                          onClick={() => {
                            positionEmotePanel();
                            setEmoteOpen((current) => {
                              const next = !current;
                              if (!next) setEmoteCategoryOpen(false);
                              return next;
                            });
                          }}
                          className={`h-7 w-7 rounded-md border transition flex items-center justify-center text-sm ${
                            emoteOpen
                              ? 'bg-purple-500/15 border-purple-400 text-purple-200'
                              : 'bg-zinc-900/70 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                          }`}
                          aria-label="Open emote picker"
                        >
                          ☺
                        </button>
                      </div>
                    </div>
                  </div>

                  {unsupportedEmbedLinks.length > 0 && (
                    <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                      To show an image or GIF preview, upload it somewhere first and paste a direct hosted media URL.
                    </div>
                  )}

                  {!!message.trim() && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-black/30">
                      <div className="border-b border-zinc-800 bg-zinc-950/70 px-3 py-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Message Preview</span>
                      </div>
                      <div className="p-4 text-sm leading-relaxed text-white">
                        <InlineMessage message={message} className="text-white" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Self-Destruct Options */}
                <div className="mb-5 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-gray-400">Self-Destruct</label>
                    <button
                      onClick={() => setSelfDestruct(!selfDestruct)}
                      className={`relative w-11 h-6 rounded-full transition ${
                        selfDestruct ? 'bg-purple-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${
                          selfDestruct ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {selfDestruct && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Max Reads (leave empty to self-destruct on first decrypt)
                      </label>
                      <input
                        type="number"
                        value={maxReads ?? ''}
                        onChange={(e) => setMaxReads(e.target.value ? Number(e.target.value) : null)}
                        placeholder="e.g. 3"
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {maxReads ? `Note will self-destruct after ${maxReads} read(s)` : 'Note will self-destruct after being decrypted once'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Premium: Guaranteed Retention (unlocked via x402) */}
                <div className="mb-5 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                      <span>⭐</span> Guaranteed retention
                      <span className="text-[10px] font-semibold text-purple-400 tracking-wide">PREMIUM</span>
                    </label>
                    <button
                      onClick={() => setGuaranteedRetention(!guaranteedRetention)}
                      className={`relative w-11 h-6 rounded-full transition ${
                        guaranteedRetention ? 'bg-purple-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${
                          guaranteedRetention ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Premium notes (multi-read, large, or guaranteed-retention) unlock with a small
                    on-chain micropayment (x402) when you create them. Ordinary notes stay free.
                  </p>
                </div>

                {/* Attach SOL Gift */}
                {connected && (
                  <div className="mb-5 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-medium text-gray-400 flex items-center gap-2">
                        <span>🎁</span> Attach SOL Gift
                      </label>
                      <button
                        onClick={() => setGiftEnabled(!giftEnabled)}
                        className={`relative w-11 h-6 rounded-full transition ${
                          giftEnabled ? 'bg-purple-500' : 'bg-zinc-700'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${
                            giftEnabled ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {giftEnabled && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          SOL Amount
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={giftAmount}
                            onChange={(e) => setGiftAmount(e.target.value)}
                            placeholder="0.1"
                            min="0.001"
                            step="0.001"
                            className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-gray-600 pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">SOL</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          SOL will be sent to the recipient via SplitNow when you create the note
                        </p>
                      </div>
                    )}
                  </div>
                )}

                                {/* Gift Progress */}
                {giftStep !== 'idle' && (
                  <GiftProgress step={giftStep} elapsedSec={giftElapsed} />
                )}

                {/* Error */}
                {error && (
                  <div className="mb-5 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs">
                    {error}
                  </div>
                )}

                {/* Premium indicator */}
                {isPremiumNote && !payModal && (
                  <div className="mb-4 p-3 rounded-lg border border-purple-500/40 bg-purple-500/10 text-xs text-purple-200">
                    <span className="font-semibold">Premium note.</span> {premiumReasonText} Unlocking it takes a one-time x402 micropayment.
                  </div>
                )}

                {/* x402 payment panel */}
                {payModal && (
                  <div className="mb-5 p-4 rounded-lg border border-purple-500/50 bg-black/60">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-purple-200">Pay with x402</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        HTTP 402
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      This premium note is unlocked with an on-chain micropayment.
                    </p>
                    <div className="rounded-md bg-black/50 border border-zinc-800 p-3 text-xs font-mono text-gray-300 space-y-1 mb-3">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">amount</span>
                        <span>{payModal.terms.amount} {payModal.terms.asset}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">network</span>
                        <span>{payModal.terms.network}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">pay to</span>
                        <span className="truncate">{payModal.terms.payTo}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">nonce</span>
                        <span className="truncate">{payModal.terms.nonce}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={payAndComplete}
                        disabled={loading}
                        className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-400 text-white text-sm font-medium rounded-md transition disabled:opacity-50"
                      >
                        {loading
                          ? 'Settling payment...'
                          : `Pay ${payModal.terms.amount} ${payModal.terms.asset} and send`}
                      </button>
                      <button
                        onClick={() => setPayModal(null)}
                        disabled={loading}
                        className="px-4 py-2.5 border border-zinc-700 text-gray-400 text-sm rounded-md hover:text-white transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-gray-600">
                      Mock facilitator, no real funds move. A live x402 facilitator settles real USDC with no code change.
                    </p>
                  </div>
                )}

                {/* Create Button */}
                {!payModal && (
                  <button
                    onClick={handleCreateNote}
                    disabled={loading}
                    className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loading
                      ? (giftStep !== 'idle'
                          ? (GIFT_STEPS.find((s) => s.key === giftStep)?.label ?? 'Sending gift...')
                          : 'Creating encrypted note...')
                      : isPremiumNote
                        ? 'Continue to x402 payment'
                        : (giftEnabled && giftAmount ? `Create Note + Send ${giftAmount} SOL` : 'Create Encrypted Note')}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Success State */}
                <div className="text-center">
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h2 className="text-lg font-bold text-white">Note Created!</h2>
                  </div>
                  <p className="text-gray-400 text-xs mb-4">Share this link with the recipient</p>

                  {/* URL Display */}
                  <div className="mb-5 p-4 bg-black/50 border border-zinc-700 rounded-lg">
                    <p className="text-xs text-gray-300 break-all font-mono">{noteUrl}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={copyToClipboard}
                      className="flex-1 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all duration-150 text-sm"
                    >
                      {copied ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => setNoteUrl('')}
                      className="flex-1 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition text-sm"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* How It Works */}
          <div className="mt-12 mb-2">
            <h3 className="text-center text-xl font-bold text-white mb-6">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">1</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">Recipient Registers Key</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Connect wallet and generate a one-time public key. Only needs to be done once.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">2</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">You Send Encrypted Message</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Enter recipient&apos;s wallet and message. We encrypt it with their public key.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">3</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">Recipient Decrypts & Reads</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Connect wallet to decrypt and read. Optionally watch it self-destruct.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Footer - Bottom of page */}
        <div className="text-center pb-2 text-gray-500 text-xs">
            <p>End-to-end encrypted • Zero-knowledge • Client-side encryption</p>
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

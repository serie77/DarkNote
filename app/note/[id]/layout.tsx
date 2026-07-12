import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You received an encrypted message · DarkNote",
  description: "Connect your Solana wallet to decrypt and read this private message. Zero-knowledge encryption.",
  openGraph: {
    title: "You received an encrypted message",
    description: "Connect your Solana wallet to decrypt this private message on DarkNote.",
    images: ["/darknote.png"],
  },
};

export default function NoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

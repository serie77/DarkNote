import type { Metadata } from "next";
import { Inter, Roboto_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import OwlCursor from "@/components/OwlCursorWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://darknote.io'),
  title: "DarkNote - Encrypted Messages on Solana",
  description: "Send encrypted messages secured by Solana wallets. Zero-knowledge, trustless encryption. Self-destructing notes with optional SOL gifts.",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'DarkNote - Encrypted Messages on Solana',
    description: 'Send encrypted messages secured by Solana wallets. Zero-knowledge, trustless encryption.',
    url: '/',
    siteName: 'DarkNote',
    images: [
      {
        url: '/darknote.png',
        width: 512,
        height: 512,
        alt: 'DarkNote Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DarkNote - Encrypted Messages on Solana',
    description: 'Send encrypted messages secured by Solana wallets. Zero-knowledge, trustless encryption.',
    images: ['/darknote.png'],
    creator: '@darknote',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} ${orbitron.variable} antialiased bg-black text-white`}
      >
        <WalletProvider>
          <OwlCursor />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: "DarkNote - Encrypted Messages on Solana",
  description: "Send end-to-end encrypted, self-destructing messages addressed to any Solana wallet.",
  icons: {
    icon: [
      { url: '/logo-monoline.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
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
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'DarkNote',
      },
    ],
    locale: 'en_US',
    type: 'website',
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

import { X402PaymentHandler } from 'x402-solana/server';

// two ways to run the premium payment: the mock facilitator (default, used by
// the tests and the offline demo) or real settlement on Solana devnet. flip
// X402_MODE=devnet in the env to use the real thing.
export const X402_MODE = (process.env.X402_MODE ?? 'mock') === 'devnet' ? 'devnet' : 'mock';

// circle's devnet USDC mint, 6 decimals. overridable in case it moves.
const DEVNET_USDC = process.env.DEVNET_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

let handler: X402PaymentHandler | null = null;

// built lazily so the mock path never touches the SDK or needs the env set.
export function getX402Handler(): X402PaymentHandler {
  if (!handler) {
    handler = new X402PaymentHandler({
      network: 'solana-devnet',
      treasuryAddress: process.env.PREMIUM_PAYOUT_ADDRESS ?? '',
      facilitatorUrl: process.env.X402_FACILITATOR_URL ?? '',
      rpcUrl: process.env.SOLANA_DEVNET_RPC ?? 'https://api.devnet.solana.com',
    });
  }
  return handler;
}

// price comes in as USDC (e.g. 0.5). the SDK wants atomic units, and USDC has
// 6 decimals, so 0.5 -> "500000".
export function premiumRouteConfig(amountUsdc: number) {
  return {
    amount: String(Math.round(amountUsdc * 1_000_000)),
    asset: { address: DEVNET_USDC, decimals: 6 },
    description: 'DarkNote premium note',
  };
}

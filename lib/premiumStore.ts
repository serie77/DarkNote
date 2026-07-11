import Database from 'better-sqlite3';
import path from 'path';
import { newNonce } from './x402';

/**
 * Records premium-payment challenges and their single redemption.
 *
 * Nonce redemption runs inside a synchronous better-sqlite3 transaction, which
 * completes without yielding the event loop — so concurrent requests cannot
 * interleave, and a settlement can unlock exactly one premium note (FR5, NFR4).
 */
export class PremiumStore {
  private db: Database.Database;
  private redeemTxn: (nonce: string) => { ok: boolean; amount?: number };

  constructor(dbPath?: string) {
    const resolved =
      dbPath ?? process.env.PREMIUM_DB_PATH ?? path.join(process.cwd(), 'darknote.db');
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS premium_payments (
        nonce TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    this.redeemTxn = this.db.transaction((nonce: string) => {
      const row = this.db
        .prepare('SELECT status, amount FROM premium_payments WHERE nonce = ?')
        .get(nonce) as { status: string; amount: number } | undefined;
      if (!row || row.status !== 'issued') return { ok: false };
      this.db.prepare("UPDATE premium_payments SET status = 'settled' WHERE nonce = ?").run(nonce);
      return { ok: true, amount: row.amount };
    });
  }

  /** Issue a challenge nonce for a premium price. */
  issueChallenge(amount: number, now = Date.now()): string {
    const nonce = newNonce();
    this.db
      .prepare("INSERT INTO premium_payments (nonce, status, amount, created_at) VALUES (?, 'issued', ?, ?)")
      .run(nonce, amount, now);
    return nonce;
  }

  /**
   * Atomically consume a challenge. Returns ok only the first time a valid,
   * issued nonce is redeemed; a replay or an unknown nonce returns ok:false.
   */
  redeem(nonce: string): { ok: boolean; amount?: number } {
    return this.redeemTxn(nonce);
  }

  close() {
    this.db.close();
  }
}

let cached: PremiumStore | null = null;
export function getPremiumStore(): PremiumStore {
  if (!cached) cached = new PremiumStore();
  return cached;
}

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { rmSync } from 'fs';

// Isolate the note database to a temp file via the env override, set before the
// db module is imported (dynamic import below preserves the ordering).
const dbFile = path.join(tmpdir(), `darknote-test-${randomUUID()}.db`);
process.env.DARKNOTE_DB_PATH = dbFile;

let createNote: typeof import('../lib/db').createNote;
let getNote: typeof import('../lib/db').getNote;
let deleteOldNotes: typeof import('../lib/db').deleteOldNotes;

beforeAll(async () => {
  ({ createNote, getNote, deleteOldNotes } = await import('../lib/db'));
});
afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(dbFile + suffix);
    } catch {
      /* ignore */
    }
  }
});

const base = (id: string, premium: boolean) => ({
  id,
  ciphertext: 'ct',
  nonce: 'nz',
  ephemeralPublicKey: 'ep',
  recipientAddress: 'addr',
  selfDestruct: true,
  maxReads: premium ? 5 : 1,
  giftAmountSol: null,
  giftTxSignature: null,
  premium,
});

describe('note retention (FR10)', () => {
  it('cleanup deletes free notes but exempts premium notes', () => {
    const freeId = 'free-' + randomUUID();
    const premiumId = 'prem-' + randomUUID();
    createNote(base(freeId, false));
    createNote(base(premiumId, true));

    // Negative max-age pushes the cutoff into the future so both notes count as
    // "old"; only the premium note should survive.
    deleteOldNotes(-1_000_000);

    expect(getNote(freeId)).toBeNull();
    expect(getNote(premiumId)).not.toBeNull();
    expect(getNote(premiumId)?.premium).toBe(true);
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { rmSync } from 'fs';

// Isolate the note database before the increment route (and its db singleton)
// are imported, so this suite never touches a real store.
const noteDb = path.join(tmpdir(), `darknote-selfdestruct-${randomUUID()}.db`);
process.env.DARKNOTE_DB_PATH = noteDb;

let POST: typeof import('../app/api/notes/[id]/increment/route').POST;
let createNote: typeof import('../lib/db').createNote;
let getNote: typeof import('../lib/db').getNote;

beforeAll(async () => {
  ({ POST } = await import('../app/api/notes/[id]/increment/route'));
  ({ createNote, getNote } = await import('../lib/db'));
});
afterAll(() => {
  for (const s of ['', '-wal', '-shm']) {
    try {
      rmSync(noteDb + s);
    } catch {
      /* ignore */
    }
  }
});

const RECIPIENT = 'So11111111111111111111111111111111111111112';

const makeNote = (maxReads: number | null) => {
  const id = 'sd-' + randomUUID();
  createNote({
    id,
    ciphertext: 'AAAA',
    nonce: 'BBBB',
    ephemeralPublicKey: 'CCCC',
    recipientAddress: RECIPIENT,
    selfDestruct: true,
    maxReads,
    premium: false,
  });
  return id;
};

const read = (id: string) =>
  POST(
    new Request('http://localhost/api/notes/x/increment', { method: 'POST' }) as never,
    { params: Promise.resolve({ id }) },
  );

describe('self-destruct (FR3)', () => {
  it('stays readable while reads remain within the allowance', async () => {
    const id = makeNote(3);
    for (let i = 0; i < 2; i += 1) {
      const body = await (await read(id)).json();
      expect(body.deleted).toBe(false);
    }
    expect(getNote(id)).not.toBeNull();
  });

  it('becomes unreadable once the read allowance is exhausted', async () => {
    const id = makeNote(2);
    await read(id);
    const body = await (await read(id)).json();
    expect(body.deleted).toBe(true);
    expect(getNote(id)).toBeNull();
  });
});

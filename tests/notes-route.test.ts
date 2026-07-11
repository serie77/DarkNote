import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import { rmSync } from 'fs';

// Isolate both databases (note store + premium store) to temp files before the
// route and its singletons are imported.
const noteDb = path.join(tmpdir(), `darknote-notes-${randomUUID()}.db`);
const premDb = path.join(tmpdir(), `darknote-prem-${randomUUID()}.db`);
process.env.DARKNOTE_DB_PATH = noteDb;
process.env.PREMIUM_DB_PATH = premDb;
delete process.env.X402_FACILITATOR_URL; // use the mock facilitator

let POST: typeof import('../app/api/notes/route').POST;

// A real, valid base58 Solana address (wrapped SOL mint).
const RECIPIENT = 'So11111111111111111111111111111111111111112';

beforeAll(async () => {
  ({ POST } = await import('../app/api/notes/route'));
});
afterAll(() => {
  for (const f of [noteDb, premDb]) {
    for (const s of ['', '-wal', '-shm']) {
      try {
        rmSync(f + s);
      } catch {
        /* ignore */
      }
    }
  }
});

function post(body: unknown, headers: Record<string, string> = {}, raw = false) {
  return POST(
    new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: raw ? (body as string) : JSON.stringify(body),
    }) as never,
  );
}

const noteBody = (extra: object = {}) => ({
  id: 'note-' + randomUUID(),
  ciphertext: 'AAAA',
  nonce: 'BBBB',
  ephemeralPublicKey: 'CCCC',
  recipientAddress: RECIPIENT,
  ...extra,
});

const b64 = (p: object) => Buffer.from(JSON.stringify(p)).toString('base64');

describe('POST /api/notes premium gate (FR2, FR3, FR9)', () => {
  it('creates a free note with no payment (FR2)', async () => {
    const res = await post(noteBody());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, premium: false });
  });

  it('returns 402 x402 terms for a premium request (FR3)', async () => {
    const res = await post(noteBody({ maxReads: 5 }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.accepts[0]).toMatchObject({ asset: 'USDC', network: 'solana' });
    expect(body.accepts[0].nonce).toBeTruthy();
  });

  it('creates a premium note after a verified payment', async () => {
    const challenge = await (await post(noteBody({ maxReads: 5 }))).json();
    const term = challenge.accepts[0];
    const res = await post(
      noteBody({ maxReads: 5 }),
      { 'x-payment': b64({ nonce: term.nonce, amount: term.amount, valid: true }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).premium).toBe(true);
  });

  it('rejects missing fields with a generic message (FR9)', async () => {
    const res = await post({ id: 'x' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(typeof body.error).toBe('string');
  });

  it('handles a malformed body without leaking internals (FR9)', async () => {
    const res = await post('not json at all', {}, true);
    expect([400, 500]).toContain(res.status);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/at Object|node_modules|ECONNREFUSED|DARKNOTE_DB_PATH|\/lib\//);
  });
});

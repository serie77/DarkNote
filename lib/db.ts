import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export interface Note {
  id: string;
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
  recipientAddress: string;
  createdAt: number;
  selfDestruct: boolean;
  maxReads: number | null;
  currentReads: number;
  giftAmountSol: number | null;
  giftTxSignature: string | null;
}

export interface RegisteredKey {
  walletAddress: string;
  encryptionPublicKey: string;
  registeredAt: number;
}

/**
 * Get database instance (singleton)
 */
function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'darknote.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initDb();
  }
  return db;
}

/**
 * Initialize database schema
 *
 * ZERO-KNOWLEDGE ASYMMETRIC ENCRYPTION:
 * We store: ciphertext, nonce, ephemeralPublicKey
 * Server CANNOT decrypt - only recipient's secret key can decrypt.
 */
function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL,
      ephemeralPublicKey TEXT NOT NULL,
      recipientAddress TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      selfDestruct INTEGER NOT NULL DEFAULT 1,
      maxReads INTEGER,
      currentReads INTEGER NOT NULL DEFAULT 0,
      giftAmountSol REAL,
      giftTxSignature TEXT
    )
  `);

  // Migration: Add new columns if they don't exist
  try {
    db.exec(`ALTER TABLE notes ADD COLUMN selfDestruct INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE notes ADD COLUMN maxReads INTEGER`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE notes ADD COLUMN currentReads INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE notes ADD COLUMN giftAmountSol REAL`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE notes ADD COLUMN giftTxSignature TEXT`);
  } catch {
    // Column already exists
  }

  // Create index on createdAt for cleanup of old notes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notes_createdAt ON notes(createdAt)
  `);

  // Create registered_keys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS registered_keys (
      walletAddress TEXT PRIMARY KEY,
      encryptionPublicKey TEXT NOT NULL,
      registeredAt INTEGER NOT NULL
    )
  `);
}

/**
 * Create a new encrypted note
 */
export function createNote(note: Omit<Note, 'createdAt' | 'currentReads'>): Note {
  const db = getDb();

  const createdAt = Date.now();

  const stmt = db.prepare(`
    INSERT INTO notes (id, ciphertext, nonce, ephemeralPublicKey, recipientAddress, createdAt, selfDestruct, maxReads, currentReads, giftAmountSol, giftTxSignature)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    note.id,
    note.ciphertext,
    note.nonce,
    note.ephemeralPublicKey,
    note.recipientAddress,
    createdAt,
    note.selfDestruct ? 1 : 0,
    note.maxReads ?? null,
    0,
    note.giftAmountSol ?? null,
    note.giftTxSignature ?? null
  );

  return { ...note, createdAt, currentReads: 0 };
}

/**
 * Get a note by ID and increment read count
 */
export function getNote(id: string): Note | null {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT * FROM notes WHERE id = ?
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const note = stmt.get(id) as any | undefined;
  if (!note) return null;

  // Convert SQLite integers to booleans
  const result: Note = {
    ...note,
    selfDestruct: note.selfDestruct === 1,
  };

  return result;
}

/**
 * Increment read count for a note
 */
export function incrementReadCount(id: string): boolean {
  const db = getDb();

  const stmt = db.prepare(`
    UPDATE notes SET currentReads = currentReads + 1 WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Delete a note by ID (burn after reading)
 */
export function deleteNote(id: string): boolean {
  const db = getDb();

  const stmt = db.prepare(`
    DELETE FROM notes WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Delete old notes (cleanup task - run periodically)
 * Deletes notes older than 30 days
 */
export function deleteOldNotes(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
  const db = getDb();

  const cutoffTime = Date.now() - maxAgeMs;

  const stmt = db.prepare(`
    DELETE FROM notes WHERE createdAt < ?
  `);

  const result = stmt.run(cutoffTime);
  return result.changes;
}

/**
 * Register encryption public key for a wallet
 */
export function registerKey(key: Omit<RegisteredKey, 'registeredAt'>): RegisteredKey {
  const db = getDb();
  const registeredAt = Date.now();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO registered_keys (walletAddress, encryptionPublicKey, registeredAt)
    VALUES (?, ?, ?)
  `);

  stmt.run(key.walletAddress, key.encryptionPublicKey, registeredAt);

  return { ...key, registeredAt };
}

/**
 * Get registered encryption public key for a wallet
 */
export function getRegisteredKey(walletAddress: string): RegisteredKey | null {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT * FROM registered_keys WHERE walletAddress = ?
  `);

  const key = stmt.get(walletAddress) as RegisteredKey | undefined;
  return key || null;
}

/**
 * Close database connection
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

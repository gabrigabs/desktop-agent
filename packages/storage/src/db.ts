import { Database } from "bun:sqlite";

let db: Database | null = null;

export function getDb(dbPath?: string): Database {
  if (!db) {
    const path = dbPath ?? `${process.env.HOME}/.desktop-agent/data.db`;
    db = new Database(path, { create: true });
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export type { Database } from "bun:sqlite";

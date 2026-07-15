import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let db: Database | null = null;

export function getDb(dbPath?: string): Database {
  if (!db) {
    const path = dbPath ?? `${process.env.HOME}/.desktop-agent/data.db`;
    try {
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error("Failed to create database directory:", err);
    }
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

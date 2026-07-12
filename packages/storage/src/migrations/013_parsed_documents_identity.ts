import type { Database } from "../db";

export function runMigration(db: Database): void {
  db.run(`
    DELETE FROM parsed_documents
    WHERE path <> ''
      AND rowid NOT IN (
        SELECT MAX(rowid)
        FROM parsed_documents
        WHERE path <> ''
        GROUP BY path
      )
  `);
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS parsed_documents_path_unique
    ON parsed_documents(path)
    WHERE path <> ''
  `);
}

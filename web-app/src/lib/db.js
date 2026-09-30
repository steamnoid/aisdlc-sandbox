import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let singleton = null;

const libDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(libDir, "..", "..", "schema.sql");
const dbFilePath = process.env.DATA_DB
  ? resolve(process.env.DATA_DB)
  : join(libDir, "..", "..", "data.db");

function applySchema(db) {
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}

export function getDb() {
  if (singleton) return singleton;
  const db = new Database(dbFilePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  singleton = db;
  return singleton;
}

export function getTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return applySchema(db);
}

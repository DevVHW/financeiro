const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const file = process.env.DB_PATH || path.join(__dirname, "..", "data", "financeiro.db");
if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    description  TEXT    NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    type         TEXT    NOT NULL CHECK (type IN ('in','out')),
    category     TEXT    NOT NULL,
    date         TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
`);

module.exports = db;

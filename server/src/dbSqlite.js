import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const dataDir = path.join(pkgRoot, 'data');
const dbPath = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const SQL = await initSqlJs({
  locateFile: (file) =>
    path.join(pkgRoot, 'node_modules', 'sql.js', 'dist', file),
});

let filebuffer = null;
if (fs.existsSync(dbPath)) {
  filebuffer = new Uint8Array(fs.readFileSync(dbPath));
}
const db = new SQL.Database(filebuffer);

function persist() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

db.exec(`
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  sheet_name TEXT,
  headers_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  kpi_total INTEGER NOT NULL,
  kpi_review INTEGER NOT NULL,
  kpi_violation INTEGER NOT NULL,
  kpi_ok INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  review_status TEXT NOT NULL,
  badge_class TEXT NOT NULL,
  reason TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_rows(batch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail_json TEXT
);
`);

db.exec('PRAGMA foreign_keys = ON');
persist();

export function insertImportBatch({
  id,
  filename,
  sheetName,
  headers,
  kpi,
  rows,
}) {
  const now = new Date().toISOString();
  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      `INSERT INTO import_batches (
        id, filename, sheet_name, headers_json, created_at,
        row_count, kpi_total, kpi_review, kpi_violation, kpi_ok
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        filename,
        sheetName || '',
        JSON.stringify(headers),
        now,
        rows.length,
        kpi.total,
        kpi.reviewPending,
        kpi.violation,
        kpi.ok,
      ],
    );

    const insRow = db.prepare(
      `INSERT INTO import_rows (
        batch_id, row_index, raw_json, risk_score, review_status, badge_class, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    rows.forEach((row, i) => {
      insRow.run([
        id,
        i,
        JSON.stringify(row.raw),
        row.review.risk,
        row.review.status,
        row.review.badge,
        row.review.reason,
      ]);
    });
    insRow.free();

    db.run(
      `INSERT INTO audit_logs (occurred_at, action, entity_type, entity_id, detail_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        now,
        'import.upload',
        'import_batch',
        id,
        JSON.stringify({ filename, rowCount: rows.length }),
      ],
    );
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  persist();
}

export function listBatches(limit = 50) {
  const stmt = db.prepare(
    `SELECT id, filename, sheet_name, created_at, row_count,
            kpi_total, kpi_review, kpi_violation, kpi_ok
     FROM import_batches
     ORDER BY created_at DESC
     LIMIT ?`,
  );
  stmt.bind([limit]);
  const out = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject());
  }
  stmt.free();
  return out;
}

export function getBatchWithRows(batchId) {
  const bstmt = db.prepare(`SELECT * FROM import_batches WHERE id = ?`);
  bstmt.bind([batchId]);
  if (!bstmt.step()) {
    bstmt.free();
    return null;
  }
  const batch = bstmt.getAsObject();
  bstmt.free();

  const headers = JSON.parse(batch.headers_json);
  const rstmt = db.prepare(
    `SELECT row_index, raw_json, risk_score, review_status, badge_class, reason
     FROM import_rows WHERE batch_id = ? ORDER BY row_index ASC`,
  );
  rstmt.bind([batchId]);
  const rows = [];
  while (rstmt.step()) {
    const r = rstmt.getAsObject();
    rows.push({
      rowIndex: r.row_index,
      raw: JSON.parse(r.raw_json),
      risk_score: r.risk_score,
      review_status: r.review_status,
      badge_class: r.badge_class,
      reason: r.reason,
    });
  }
  rstmt.free();
  return { batch, headers, rows };
}

export { db, dbPath };

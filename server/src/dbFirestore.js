import { readFileSync } from 'fs';
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_COL = 'import_batches';

/** @type {import('firebase-admin/firestore').Firestore | null} */
let firestore = null;

function initAdmin() {
  if (getApps().length > 0) return;

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson && inlineJson.trim()) {
    initializeApp({
      credential: cert(JSON.parse(inlineJson)),
    });
    return;
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath && credPath.trim()) {
    const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    return;
  }

  initializeApp({ credential: applicationDefault() });
}

function getDb() {
  if (!firestore) {
    initAdmin();
    firestore = getFirestore();
  }
  return firestore;
}

const FIRESTORE_BATCH_OPS = 450;

/**
 * @param {{ id: string, filename: string, sheetName?: string, headers: string[], kpi: { total: number, reviewPending: number, violation: number, ok: number }, rows: Array<{ raw: object, review: { risk: number, status: string, badge: string, reason: string } }> }} payload
 */
export async function insertImportBatch({
  id,
  filename,
  sheetName,
  headers,
  kpi,
  rows,
}) {
  const fsdb = getDb();
  const now = new Date().toISOString();
  const batchRef = fsdb.collection(BATCH_COL).doc(id);

  await batchRef.set({
    id,
    filename,
    sheet_name: sheetName || '',
    headers_json: JSON.stringify(headers),
    created_at: now,
    row_count: rows.length,
    kpi_total: kpi.total,
    kpi_review: kpi.reviewPending,
    kpi_violation: kpi.violation,
    kpi_ok: kpi.ok,
  });

  const rowsCol = batchRef.collection('import_rows');
  let writeBatch = fsdb.batch();
  let opCount = 0;

  const flush = async () => {
    if (opCount === 0) return;
    await writeBatch.commit();
    writeBatch = fsdb.batch();
    opCount = 0;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const docRef = rowsCol.doc(String(i).padStart(6, '0'));
    writeBatch.set(docRef, {
      row_index: i,
      raw_json: JSON.stringify(row.raw),
      risk_score: row.review.risk,
      review_status: row.review.status,
      badge_class: row.review.badge,
      reason: row.review.reason,
    });
    opCount++;
    if (opCount >= FIRESTORE_BATCH_OPS) await flush();
  }
  await flush();

  await fsdb.collection('audit_logs').add({
    occurred_at: now,
    action: 'import.upload',
    entity_type: 'import_batch',
    entity_id: id,
    detail_json: JSON.stringify({ filename, rowCount: rows.length }),
  });
}

export async function listBatches(limit = 50) {
  const snap = await getDb()
    .collection(BATCH_COL)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id,
      filename: data.filename,
      sheet_name: data.sheet_name,
      created_at: data.created_at,
      row_count: data.row_count,
      kpi_total: data.kpi_total,
      kpi_review: data.kpi_review,
      kpi_violation: data.kpi_violation,
      kpi_ok: data.kpi_ok,
    };
  });
}

export async function getBatchWithRows(batchId) {
  const fsdb = getDb();
  const bref = fsdb.collection(BATCH_COL).doc(batchId);
  const bsnap = await bref.get();
  if (!bsnap.exists) return null;

  const b = bsnap.data();
  const batch = {
    id: b.id,
    filename: b.filename,
    sheet_name: b.sheet_name,
    headers_json: b.headers_json,
    created_at: b.created_at,
    row_count: b.row_count,
    kpi_total: b.kpi_total,
    kpi_review: b.kpi_review,
    kpi_violation: b.kpi_violation,
    kpi_ok: b.kpi_ok,
  };

  const headers = JSON.parse(batch.headers_json);
  const rsnap = await bref
    .collection('import_rows')
    .orderBy('row_index', 'asc')
    .get();

  const rows = rsnap.docs.map((doc) => {
    const r = doc.data();
    return {
      rowIndex: r.row_index,
      raw: JSON.parse(r.raw_json),
      risk_score: r.risk_score,
      review_status: r.review_status,
      badge_class: r.badge_class,
      reason: r.reason,
    };
  });

  return { batch, headers, rows };
}

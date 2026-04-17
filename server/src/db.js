const useFirestore =
  process.env.DATABASE_BACKEND === 'firestore' ||
  process.env.USE_FIREBASE_FIRESTORE === '1' ||
  process.env.USE_FIRESTORE === '1';

/** @returns {'sqlite' | 'firestore'} */
export function getDatabaseBackend() {
  return useFirestore ? 'firestore' : 'sqlite';
}

/** @type {Promise<typeof import('./dbSqlite.js')> | null} */
let sqliteModPromise = null;
/** @type {Promise<typeof import('./dbFirestore.js')> | null} */
let firestoreModPromise = null;

function loadSqlite() {
  if (!sqliteModPromise) sqliteModPromise = import('./dbSqlite.js');
  return sqliteModPromise;
}

function loadFirestore() {
  if (!firestoreModPromise) firestoreModPromise = import('./dbFirestore.js');
  return firestoreModPromise;
}

export async function insertImportBatch(payload) {
  if (useFirestore) {
    const m = await loadFirestore();
    return m.insertImportBatch(payload);
  }
  const m = await loadSqlite();
  m.insertImportBatch(payload);
}

export async function listBatches(limit = 50) {
  if (useFirestore) {
    const m = await loadFirestore();
    return m.listBatches(limit);
  }
  const m = await loadSqlite();
  return m.listBatches(limit);
}

export async function getBatchWithRows(batchId) {
  if (useFirestore) {
    const m = await loadFirestore();
    return m.getBatchWithRows(batchId);
  }
  const m = await loadSqlite();
  return m.getBatchWithRows(batchId);
}

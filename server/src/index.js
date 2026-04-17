import './bootstrapEnv.js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { parseWorkbookBuffer } from './parseSheet.js';
import {
  parsePoliciesFromFormString,
  parsePoliciesFromJson,
} from './cardMonitorPolicies.js';
import {
  insertImportBatch,
  listBatches,
  getBatchWithRows,
  getDatabaseBackend,
} from './db.js';
import XLSX from 'xlsx';
import {
  assertProductionSecurityConfig,
  assertAllowedUpload,
  delayJitter,
  getAdminPassword,
  getCorsOriginOption,
  isUuidParam,
  timingSafeStringEqual,
} from './security.js';

assertProductionSecurityConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const app = express();
const PORT = Number(process.env.PORT) || 3001;

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: getCorsOriginOption(),
    credentials: true,
    maxAge: 86400,
  }),
);

app.use(express.json({ limit: '100kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const sessionSecret =
  process.env.SESSION_SECRET || 'card-monitor-dev-secret-change-me';
if (
  process.env.NODE_ENV !== 'production' &&
  sessionSecret === 'card-monitor-dev-secret-change-me'
) {
  console.warn(
    '[보안] SESSION_SECRET을 바꾸지 않은 개발 모드입니다. 운영 배포 전에 반드시 설정하세요.',
  );
}

app.use(
  session({
    name: 'cardMonitor.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    },
  }),
);

function requireAuth(req, res, next) {
  if (req.session?.user === 'admin') {
    next();
    return;
  }
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

app.get('/api/health', (_req, res) => {
  const database = getDatabaseBackend();
  if (process.env.NODE_ENV === 'production') {
    res.json({ ok: true, database });
    return;
  }
  res.json({ ok: true, service: 'card-monitor-api', database });
});

const ADMIN_USER = process.env.CARD_MONITOR_ADMIN_USER || 'admin';

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const expectedPassword = getAdminPassword();

  const okUser =
    typeof username === 'string' &&
    typeof ADMIN_USER === 'string' &&
    timingSafeStringEqual(username, ADMIN_USER);

  const okPass =
    expectedPassword &&
    typeof password === 'string' &&
    timingSafeStringEqual(password, expectedPassword);

  if (okUser && okPass) {
    req.session.user = 'admin';
    res.json({ ok: true, user: 'admin' });
    return;
  }

  await delayJitter();
  res
    .status(401)
    .json({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: '로그아웃 실패' });
      return;
    }
    res.clearCookie('cardMonitor.sid', { path: '/' });
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session?.user) {
    res.json({ ok: true, user: req.session.user });
    return;
  }
  res.status(401).json({ ok: false });
});

app.get('/design-preview.html', (req, res, next) => {
  if (!req.session?.user) {
    res.redirect(
      302,
      '/login.html?return=' +
        encodeURIComponent(req.originalUrl || '/design-preview.html'),
    );
    return;
  }
  res.sendFile(path.join(rootDir, 'design-preview.html'), (err) => {
    if (err) next(err);
  });
});

app.post('/api/import/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: 'file 필드가 필요합니다.' });
      return;
    }
    assertAllowedUpload(req.file);
    const filename = path.basename(req.file.originalname || 'upload');
    const parsed = parseWorkbookBuffer(req.file.buffer, filename);
    if (!parsed.rows.length) {
      res.status(400).json({
        error: '데이터 행이 없습니다. 첫 행을 헤더로 두세요.',
      });
      return;
    }
    const id = crypto.randomUUID();
    await insertImportBatch({
      id,
      filename,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      kpi: parsed.kpi,
      rows: parsed.rows,
    });
    res.status(201).json({
      batchId: id,
      sheetName: parsed.sheetName,
      filename,
      kpi: parsed.kpi,
      headers: parsed.headers,
      rows: parsed.rows.map((r) => ({
        raw: r.raw,
        risk_score: r.review.risk,
        review_status: r.review.status,
        badge_class: r.review.badge,
        row_class: r.review.rowClass,
        reason: r.review.reason,
      })),
    });
  } catch (e) {
    if (e.code === 'ALLOWED_FILE_TYPES' || e.code === 'MIME_NOT_ALLOWED') {
      res.status(400).json({ error: '허용되지 않는 파일 형식입니다.' });
      return;
    }
    if (e instanceof multer.MulterError) {
      res.status(400).json({ error: '파일 업로드 제한을 초과했습니다.' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: '업로드 처리 실패' });
  }
});

app.post('/api/import/sample', requireAuth, async (req, res) => {
  try {
    const policiesList = parsePoliciesFromJson(req.body?.policies);
    const ws = XLSX.utils.aoa_to_sheet([
      ['거래일시', '가맹점명', '이용금액', '비고'],
      ['2025-03-26 12:30', '○○식당', 35000, ''],
      ['2025-03-26 14:00', '△△유흥주점', 120000, ''],
      ['2025-03-25 09:00', '□□전자', 1250000, '고액'],
      ['2025-03-24 18:00', '◇◇마트', 89000, ''],
      ['2025-03-23 22:00', 'Night BAR Seoul', 450000, ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래내역');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const parsed = parseWorkbookBuffer(buf, 'sample.xlsx', policiesList);
    const id = crypto.randomUUID();
    await insertImportBatch({
      id,
      filename: 'sample.xlsx',
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      kpi: parsed.kpi,
      rows: parsed.rows,
    });
    res.status(201).json({
      batchId: id,
      sheetName: parsed.sheetName,
      filename: 'sample.xlsx',
      kpi: parsed.kpi,
      headers: parsed.headers,
      rows: parsed.rows.map((r) => ({
        raw: r.raw,
        risk_score: r.review.risk,
        review_status: r.review.status,
        badge_class: r.review.badge,
        row_class: r.review.rowClass,
        reason: r.review.reason,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '샘플 생성 실패' });
  }
});

app.get('/api/import/batches', requireAuth, async (_req, res) => {
  try {
    const rows = await listBatches(100);
    res.json({ batches: rows });
  } catch (e) {
    res.status(500).json({ error: '목록 조회 실패' });
  }
});

app.get('/api/import/batches/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuidParam(id)) {
      res.status(400).json({ error: '잘못된 배치 ID입니다.' });
      return;
    }
    const data = await getBatchWithRows(id);
    if (!data) {
      res.status(404).json({ error: '배치를 찾을 수 없습니다.' });
      return;
    }
    res.json({
      batch: {
        id: data.batch.id,
        filename: data.batch.filename,
        sheet_name: data.batch.sheet_name,
        created_at: data.batch.created_at,
        row_count: data.batch.row_count,
        kpi: {
          total: data.batch.kpi_total,
          reviewPending: data.batch.kpi_review,
          violation: data.batch.kpi_violation,
          ok: data.batch.kpi_ok,
        },
      },
      headers: data.headers,
      rows: data.rows.map((r) => ({
        raw: r.raw,
        risk_score: r.risk_score,
        review_status: r.review_status,
        badge_class: r.badge_class,
        reason: r.reason,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: '조회 실패' });
  }
});

app.get('/', (_req, res) => {
  res.redirect(302, '/login.html');
});

app.use(express.static(rootDir));

const server = app.listen(PORT, () => {
  console.log(`서버 http://localhost:${PORT}`);
  console.log(`로그인: http://localhost:${PORT}/login.html`);
  console.log(`대시보드: http://localhost:${PORT}/design-preview.html`);
  console.log(
    `[저장소] ${getDatabaseBackend() === 'firestore' ? 'Firebase Firestore' : 'SQLite (server/data/app.db)'}`,
  );
});
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `포트 ${PORT}가 이미 사용 중입니다. 다른 창에서 실행 중인 서버를 종료하거나, 환경 변수 PORT로 다른 포트를 지정하세요.`,
    );
    process.exit(1);
  }
  throw err;
});

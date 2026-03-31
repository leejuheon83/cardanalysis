import crypto from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) {
    console.error(
      '[보안] 프로덕션에서는 SESSION_SECRET이 필요합니다(32자 이상 임의 문자열).',
    );
    process.exit(1);
  }

  const pwd = process.env.CARD_MONITOR_ADMIN_PASSWORD || '';
  if (pwd.length < 12) {
    console.error(
      '[보안] 프로덕션에서는 CARD_MONITOR_ADMIN_PASSWORD가 필요합니다(12자 이상 강한 비밀번호).',
    );
    process.exit(1);
  }
}

export function getCorsOriginOption() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw && raw.trim()) {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return function originCallback(origin, cb) {
      if (!origin) return cb(null, true);
      if (list.includes(origin)) return cb(null, true);
      return cb(null, false);
    };
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[보안] ALLOWED_ORIGINS 미설정: 프로덕션에서는 브라우저 출처 없는 요청만 CORS 통과 가능합니다.',
    );
    return function originCallback(origin, cb) {
      if (!origin) return cb(null, true);
      return cb(null, false);
    };
  }
  return true;
}

const STRING_CMP_MAX = 512;

/** 고정 길이 버퍼 비교로 문자열 노출·타이밍 차이를 줄입니다. */
export function timingSafeStringEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  if (!expected || expected.length > STRING_CMP_MAX) {
    return false;
  }
  if (provided.length > STRING_CMP_MAX) {
    return false;
  }
  try {
    const a = Buffer.alloc(STRING_CMP_MAX, 0);
    const b = Buffer.alloc(STRING_CMP_MAX, 0);
    Buffer.from(provided, 'utf8').copy(a);
    Buffer.from(expected, 'utf8').copy(b);
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getAdminPassword() {
  const fromEnv = process.env.CARD_MONITOR_ADMIN_PASSWORD;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  console.warn(
    '[보안] CARD_MONITOR_ADMIN_PASSWORD 미설정 — 개발 전용 기본 비밀번호 사용 중입니다. 운영에 사용하지 마세요.',
  );
  return 'admin';
}

export function delayJitter(msMin = 80, msMax = 180) {
  const ms = msMin + Math.floor(Math.random() * (msMax - msMin + 1));
  return new Promise((r) => setTimeout(r, ms));
}

export function isUuidParam(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

const UPLOAD_EXT = /\.(xlsx|xlsm|xls|csv)$/i;

export function assertAllowedUpload(file) {
  if (!file?.originalname || !UPLOAD_EXT.test(file.originalname)) {
    const err = new Error('ALLOWED_FILE_TYPES');
    err.code = 'ALLOWED_FILE_TYPES';
    throw err;
  }
  const mt = (file.mimetype || '').toLowerCase();
  const okMime =
    !mt ||
    mt === 'application/octet-stream' ||
    mt === 'application/vnd.ms-excel' ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'text/csv' ||
    mt === 'text/plain' ||
    mt === 'application/csv';
  if (!okMime) {
    const err = new Error('MIME_NOT_ALLOWED');
    err.code = 'MIME_NOT_ALLOWED';
    throw err;
  }
}

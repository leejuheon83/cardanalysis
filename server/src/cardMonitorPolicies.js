/**
 * design-preview 정책 탭과 동일 (web/lib/card-monitor/policies.ts 와 맞춤)
 */

export function normalizePolicy(p) {
  return {
    id: p.id != null ? String(p.id) : 'p' + Date.now(),
    name: p.name == null ? '' : String(p.name),
    keyword: p.keyword == null ? '' : String(p.keyword),
    amountMin:
      typeof p.amountMin === 'number' && !Number.isNaN(p.amountMin)
        ? p.amountMin
        : Number(p.amountMin) || 0,
    timeStart: p.timeStart == null ? '' : String(p.timeStart),
    timeEnd: p.timeEnd == null ? '' : String(p.timeEnd),
  };
}

export function defaultPolicies() {
  return [
    normalizePolicy({
      id: 'p1',
      name: '고액 100만 이상',
      keyword: '',
      amountMin: 1000000,
      timeStart: '',
      timeEnd: '',
    }),
    normalizePolicy({
      id: 'p2',
      name: '유흥 키워드',
      keyword: '유흥',
      amountMin: 0,
      timeStart: '',
      timeEnd: '',
    }),
    normalizePolicy({
      id: 'p3',
      name: '주말 야간',
      keyword: 'BAR',
      amountMin: 300000,
      timeStart: '',
      timeEnd: '',
    }),
  ];
}

export function parsePoliciesFromJson(json) {
  if (json == null) return defaultPolicies();
  if (!Array.isArray(json)) return defaultPolicies();
  if (json.length === 0) return [];
  return json.map(normalizePolicy);
}

export function parsePoliciesFromFormString(raw) {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) {
    return defaultPolicies();
  }
  try {
    const parsed = JSON.parse(raw);
    return parsePoliciesFromJson(parsed);
  } catch {
    return defaultPolicies();
  }
}

export function parseTimeInputToMinutes(s) {
  if (s == null || !String(s).trim()) return null;
  const parts = String(s).trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59)
    return null;
  return h * 60 + m;
}

export function parseRowTimeMinutes(v) {
  if (v == null || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return v.getHours() * 60 + v.getMinutes();
  }
  if (typeof v === 'number' && !isNaN(v)) {
    const av = Math.abs(v);
    if (av > 0 && av < 1) {
      return ((Math.round(v * 24 * 60) % (24 * 60)) + 24 * 60) % (24 * 60);
    }
    if (av >= 1 && av < 6000000) {
      let frac = v % 1;
      if (frac < 0) frac += 1;
      return Math.round(frac * 24 * 60) % (24 * 60);
    }
    return null;
  }
  const str = String(v).trim();
  const mm = str.match(/(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*(\d{2}))?/);
  if (mm) {
    const hh = parseInt(mm[1], 10);
    const mi = parseInt(mm[2], 10);
    if (hh >= 0 && hh < 48 && mi >= 0 && mi < 60) return hh * 60 + mi;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  return null;
}

export function policyMatches(p, row) {
  const amount = row._amount || 0;
  const merchant = String(row._merchant || '');
  if (p.amountMin > 0 && amount < p.amountMin) return false;
  if (p.keyword && String(p.keyword).trim()) {
    const kw = String(p.keyword).trim();
    if (
      merchant.indexOf(kw) === -1 &&
      merchant.toUpperCase().indexOf(kw.toUpperCase()) === -1
    ) {
      return false;
    }
  }
  const ts = p.timeStart ? String(p.timeStart).trim() : '';
  const te = p.timeEnd ? String(p.timeEnd).trim() : '';
  if (!ts && !te) return true;
  const rowMins = parseRowTimeMinutes(row._date);
  if (rowMins == null) return false;
  const startM = ts ? parseTimeInputToMinutes(ts) : null;
  const endM = te ? parseTimeInputToMinutes(te) : null;
  if (ts && startM == null) return false;
  if (te && endM == null) return false;
  if (!ts && endM != null) return rowMins <= endM;
  if (ts && !te && startM != null) return rowMins >= startM;
  if (startM != null && endM != null) {
    if (startM <= endM) return rowMins >= startM && rowMins <= endM;
    return rowMins >= startM || rowMins <= endM;
  }
  return true;
}

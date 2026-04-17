import XLSX from 'xlsx';
import { defaultPolicies } from './cardMonitorPolicies.js';
import {
  mapHeaders,
  parseAmount,
  autoReviewWithPolicies,
  summarizeKpiFromReviews,
} from './reviewEngine.js';

/**
 * 첫 시트 → 헤더 + 객체 배열 + 행별 자동 검토
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @param {Array<Record<string, unknown>> | null} [policies] null이면 기본 정책 세트
 */
export function parseWorkbookBuffer(buffer, filename = '', policies = null) {
  const policiesList =
    policies == null
      ? defaultPolicies()
      : Array.isArray(policies)
        ? policies
        : defaultPolicies();

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('시트가 없습니다.');
  }
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows.length) {
    return {
      sheetName,
      filename,
      headers: [],
      rows: [],
      kpi: { total: 0, reviewPending: 0, violation: 0, ok: 0 },
    };
  }

  const headers = rows[0].map((h, i) => {
    const t = String(h).trim();
    return t || `열${i + 1}`;
  });

  const colMap = mapHeaders(headers);
  const objects = [];

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    let empty = true;
    for (let j = 0; j < line.length; j++) {
      if (line[j] !== '' && line[j] != null) {
        empty = false;
        break;
      }
    }
    if (empty) continue;

    const raw = {};
    for (let c = 0; c < headers.length; c++) {
      raw[headers[c]] = line[c];
    }
    const amount =
      colMap.idxAmount >= 0 ? parseAmount(line[colMap.idxAmount]) : 0;
    const merchant =
      colMap.idxMerchant >= 0 ? String(line[colMap.idxMerchant] ?? '') : '';
    const dateVal = colMap.idxDate >= 0 ? line[colMap.idxDate] : '';

    const review = autoReviewWithPolicies(
      { _amount: amount, _merchant: merchant, _date: dateVal },
      policiesList,
    );
    objects.push({
      raw,
      _amount: amount,
      _merchant: merchant,
      _date: dateVal,
      review,
    });
  }

  const kpi = summarizeKpiFromReviews(objects.map((x) => x.review));

  return {
    sheetName,
    filename,
    headers,
    rows: objects,
    kpi,
  };
}

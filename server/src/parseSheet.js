import XLSX from 'xlsx';
import { mapHeaders, parseAmount, autoReview, summarizeKpi } from './reviewEngine.js';

/**
 * 첫 시트 → 헤더 + 객체 배열 + 행별 자동 검토
 * @param {Buffer} buffer
 * @param {string} [filename]
 */
export function parseWorkbookBuffer(buffer, filename = '') {
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

    const review = autoReview({ _amount: amount, _merchant: merchant });
    objects.push({
      raw,
      _amount: amount,
      _merchant: merchant,
      _date: dateVal,
      review,
    });
  }

  const kpi = summarizeKpi(
    objects.map((x) => ({
      _amount: x._amount,
      _merchant: x._merchant,
    })),
  );

  return {
    sheetName,
    filename,
    headers,
    rows: objects,
    kpi,
  };
}

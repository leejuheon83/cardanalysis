import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "@/lib/excel-parse";
import { rowToTransactionInput } from "@/lib/csv-parse";

test("엑셀 파일의 첫 시트를 행 데이터로 파싱한다", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["사용자", "업체명", "승인일자", "승인시간", "이용금액", "메모"],
    ["홍길동", "스타벅스", "2026-03-26", "09:10:11", "12,300", "테스트"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const parsed = parseExcelBuffer(buffer);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.사용자, "홍길동");
  assert.equal(parsed.rows[0]?.업체명, "스타벅스");
});

test("승인일자 + 승인시간 헤더를 거래일시로 결합 매핑한다", () => {
  const row = {
    사용자: "홍길동",
    업체명: "스타벅스",
    승인일자: "2026-03-26",
    승인시간: "09:10:11",
    이용금액: "12,300",
  };

  const mapped = rowToTransactionInput(row);
  assert.ok(mapped);
  assert.equal(mapped?.amount, 12300);
  assert.equal(mapped?.merchantName, "스타벅스");
  assert.equal(mapped?.userLabel, "홍길동");
  assert.equal(mapped?.txnDate.getFullYear(), 2026);
  assert.equal((mapped?.txnDate.getMonth() ?? -1) + 1, 3);
  assert.equal(mapped?.txnDate.getDate(), 26);
  assert.equal(mapped?.txnDate.getHours(), 9);
  assert.equal(mapped?.txnDate.getMinutes(), 10);
  assert.equal(mapped?.txnDate.getSeconds(), 11);
});

test("승인일자·승인시간이 엑셀 시리얼(숫자 문자열)이어도 매핑한다", () => {
  const daySerial = 45782;
  const timeSerial = (9 * 3600 + 10 * 60 + 11) / 86400;
  const row = {
    사용자: "홍길동",
    업체명: "스타벅스",
    승인일자: String(daySerial),
    승인시간: String(timeSerial),
    이용금액: "12300",
  };
  const mapped = rowToTransactionInput(row);
  assert.ok(mapped);
  assert.equal(mapped?.amount, 12300);
  assert.ok(mapped?.txnDate.getTime() > 0);
});

test("승인일자 셀에 날짜+시간이 한 시리얼로만 있어도 매핑한다", () => {
  const daySerial = 45782;
  const timeSerial = (9 * 3600 + 10 * 60 + 11) / 86400;
  const row = {
    업체명: "스타벅스",
    승인일자: String(daySerial + timeSerial),
    이용금액: "5000",
  };
  const mapped = rowToTransactionInput(row);
  assert.ok(mapped);
  assert.equal(mapped?.amount, 5000);
});

test("2026. 3. 26 형식과 시간 문자열을 매핑한다", () => {
  const row = {
    승인일자: "2026. 3. 26.",
    승인시간: "09:10:11",
    이용금액: "1000",
    업체명: "테스트상점",
  };
  const mapped = rowToTransactionInput(row);
  assert.ok(mapped);
  assert.equal(mapped?.txnDate.getFullYear(), 2026);
  assert.equal((mapped?.txnDate.getMonth() ?? -1) + 1, 3);
  assert.equal(mapped?.txnDate.getDate(), 26);
});

test("승인일·승인시각·YYYYMMDD·총금액(신청금액 0) 형식을 매핑한다", () => {
  const row = {
    사용자: "박건도",
    승인일: "20260321",
    승인시각: "12:59:01",
    가맹점명: "한국문화예술위원회",
    총금액: "1,215,000",
    신청금액: "0",
  };
  const mapped = rowToTransactionInput(row);
  assert.ok(mapped);
  assert.equal(mapped?.amount, 1215000);
  assert.equal(mapped?.merchantName, "한국문화예술위원회");
  assert.equal(mapped?.userLabel, "박건도");
  assert.equal(mapped?.txnDate.getFullYear(), 2026);
  assert.equal((mapped?.txnDate.getMonth() ?? -1) + 1, 3);
  assert.equal(mapped?.txnDate.getDate(), 21);
  assert.equal(mapped?.txnDate.getHours(), 12);
  assert.equal(mapped?.txnDate.getMinutes(), 59);
  assert.equal(mapped?.txnDate.getSeconds(), 1);
});

test("첫 행이 제목이고 둘째 행이 헤더인 엑셀을 파싱한다", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["법인카드 승인 내역", "", "", "", ""],
    ["사용자", "업체명", "승인일자", "승인시간", "이용금액"],
    ["홍길동", "스타벅스", "2026-03-26", "09:10:11", "1,000"],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const parsed = parseExcelBuffer(buffer);
  assert.equal(parsed.rows.length, 1);
  const mapped = rowToTransactionInput(parsed.rows[0] ?? {});
  assert.ok(mapped);
  assert.equal(mapped?.userLabel, "홍길동");
  assert.equal(mapped?.amount, 1000);
});


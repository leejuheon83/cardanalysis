import test from "node:test";
import assert from "node:assert/strict";
import { excelSerialToLocalDate, maybeExcelSerial } from "@/lib/excel-date-serial";

test("maybeExcelSerial은 엑셀 일자 시리얼을 인식한다", () => {
  assert.equal(maybeExcelSerial("45782"), 45782);
  assert.equal(maybeExcelSerial("45782.5"), 45782.5);
});

test("maybeExcelSerial은 시간만 소수(0~1)인 셀을 인식한다", () => {
  assert.ok(maybeExcelSerial("0.3826388888888889") !== null);
});

test("excelSerialToLocalDate는 일부+소수부(시간)를 반영한다", () => {
  const d = excelSerialToLocalDate(45782 + (9 * 3600 + 10 * 60 + 11) / 86400);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 10);
  assert.equal(d.getSeconds(), 11);
});

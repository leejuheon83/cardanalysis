/**
 * 엑셀 Windows 기본: 날짜를 일 단위 시리얼(1899-12-30 기준) + 시간은 일의 소수부로 저장.
 * @see https://docs.sheetjs.com/docs/csf/features/dates
 */
export function excelSerialToLocalDate(serial: number): Date {
  const utcDays = Math.floor(serial) - 25569;
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 1e-12;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
    hours,
    minutes,
    seconds,
  );
}

export function maybeExcelSerial(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  // 카드 거래일(대략 1980~2050)에 해당하는 시리얼 대역
  if (n >= 20000 && n < 55000) return n;
  // 시간만 소수(0~1)인 셀
  if (n >= 0 && n < 1) return n;
  return null;
}

const UPLOAD_EXT = /\.(xlsx|xlsm|xls|csv)$/i;

export function assertAllowedUploadFile(file: File): void {
  const name = file.name || "";
  if (!name || !UPLOAD_EXT.test(name)) {
    const e = new Error("ALLOWED_FILE_TYPES");
    (e as Error & { code?: string }).code = "ALLOWED_FILE_TYPES";
    throw e;
  }
  const mt = (file.type || "").toLowerCase();
  const okMime =
    !mt ||
    mt === "application/octet-stream" ||
    mt === "application/vnd.ms-excel" ||
    mt ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mt === "text/csv" ||
    mt === "text/plain" ||
    mt === "application/csv";
  if (!okMime) {
    const e = new Error("MIME_NOT_ALLOWED");
    (e as Error & { code?: string }).code = "MIME_NOT_ALLOWED";
    throw e;
  }
}

import crypto from "crypto";

const MAX = 512;

export function timingSafeStringEqual(
  provided: string,
  expected: string,
): boolean {
  if (typeof provided !== "string" || typeof expected !== "string")
    return false;
  if (!expected || expected.length > MAX) return false;
  if (provided.length > MAX) return false;
  try {
    const a = Buffer.alloc(MAX, 0);
    const b = Buffer.alloc(MAX, 0);
    Buffer.from(provided, "utf8").copy(a);
    Buffer.from(expected, "utf8").copy(b);
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

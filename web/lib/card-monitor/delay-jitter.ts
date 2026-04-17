export function delayJitter(msMin = 80, msMax = 180): Promise<void> {
  const ms = msMin + Math.floor(Math.random() * (msMax - msMin + 1));
  return new Promise((r) => setTimeout(r, ms));
}

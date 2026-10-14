export function sameVersion(stored: unknown, requested: string): boolean {
  const left = stored instanceof Date ? stored.getTime() : Date.parse(String(stored));
  const right = Date.parse(requested);
  return Number.isFinite(left) && left === right;
}

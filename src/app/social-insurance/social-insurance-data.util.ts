/**
 * yyyyMmは2026-04
 */

export function lastDayOfYyyyMm(yyyyMm: string): string {
    const year = Number(yyyyMm.slice(0, 4));
    const month = Number(yyyyMm.slice(5, 7));
    const last = new Date(year, month, 0);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, '0');
    const d = String(last.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function parseYyyyMm(yyyyMm: string): { year: number; month: number } {
    const year = Number(yyyyMm.slice(0, 4));
    const month = Number(yyyyMm.slice(5, 7));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      throw new Error(`Invalid yyyyMm: ${yyyyMm}`);
    }
    return { year, month };
}

export function daysInMonth(yyyyMm: string): number {
  const { year, month } = parseYyyyMm(yyyyMm);
  return new Date(year, month, 0).getDate();
}

export function addMonths(yyyyMm: string, delta: number): string {
  const { year, month } = parseYyyyMm(yyyyMm);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
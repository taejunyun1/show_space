/** Geometry, coordinates and exports keep millimetres; this preference only affects the UI. */
export type LengthUnit = 'mm' | 'cm' | 'm';
export const LENGTH_UNITS: readonly LengthUnit[] = ['mm', 'cm', 'm'];
export function parseLengthUnit(value: unknown): LengthUnit {
  if (value === undefined) return 'mm';
  if (value === 'mm' || value === 'cm' || value === 'm') return value;
  throw new Error('표시 단위는 mm, cm, m 중 하나여야 합니다.');
}
export function lengthFactor(unit: LengthUnit): number { return unit === 'm' ? 1000 : unit === 'cm' ? 10 : 1; }
export function displayLength(valueMm: number, unit: LengthUnit): number { return valueMm / lengthFactor(unit); }
export function lengthInMm(value: number, unit: LengthUnit): number { return value * lengthFactor(unit); }
export function lengthPrecision(unit: LengthUnit, mmPrecision = 2): number { return mmPrecision + (unit === 'm' ? 3 : unit === 'cm' ? 1 : 0); }
export function lengthDraft(valueMm: number, unit: LengthUnit, mmPrecision = 2): string {
  return String(Number(displayLength(valueMm, unit).toFixed(lengthPrecision(unit, mmPrecision))));
}
export function formatLength(valueMm: number, unit: LengthUnit = 'mm'): string {
  return `${displayLength(valueMm, unit).toLocaleString('ko-KR', {maximumFractionDigits: lengthPrecision(unit)})} ${unit}`;
}
/** An unchanged rounded display must never rewrite the more precise source value on blur. */
export function readLengthDraft(draft: string, initial: string, valueMm: number, unit: LengthUnit, min?: number, max?: number): number | null {
  if (draft === initial) return valueMm;
  const value = lengthInMm(Number(draft), unit);
  return draft.trim() && Number.isFinite(value) && (min === undefined || value >= min) && (max === undefined || value <= max) ? value : null;
}

import type { BonusData, BonusTypeDefinition } from '../../bonus-document';
import type { MonthPaymentBaseInput } from './payment-base-days';
import type { MonthlyRemunerationSource } from './remuneration-month-input';
import { addMonths } from '../monthly/social-insurance-data.util';

export interface BonusRecordInPeriod {
  yyyyMm: string;
  bonusData: BonusData;
}

export function teijiBonusLookbackRange(teijiYear: number): { from: string; to: string } {
  return { from: `${teijiYear - 1}-07`, to: `${teijiYear}-06` };
}

/** 定時決定の effectiveFrom（例: 2026-09）から定時決定の対象年を得る */
export function teijiYearFromEffectiveFrom(effectiveFrom: string): number {
  return Number(effectiveFrom.slice(0, 4));
}

function findDef(type: string, defs: readonly BonusTypeDefinition[]) {
  return defs.find((d) => d.type === type);
}

function laborAmountForType(bonusData: BonusData, type: string): number {
  const amount = bonusData[type];
  return typeof amount === 'number' && amount > 0 ? amount : 0;
}

export function sumLaborBonusAmount(
  bonusData: BonusData,
  defs: readonly BonusTypeDefinition[],
): number {
  return Object.entries(bonusData).reduce((sum, [key, amount]) => {
    if (key === 'total' || typeof amount !== 'number' || amount <= 0) return sum;
    return findDef(key, defs)?.target === 'labor' ? sum + amount : sum;
  }, 0);
}

export function countLaborBonusPayments(
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): number {
  return records.filter((r) => sumLaborBonusAmount(r.bonusData, defs) > 0).length;
}

/** 1回の支給に high（年4回以上）かつ労働対価の賞与種別が含まれるか */
export function hasHighFrequencyLaborBonus(
  bonusData: BonusData,
  defs: readonly BonusTypeDefinition[],
): boolean {
  return Object.entries(bonusData).some(([key, amount]) => {
    if (key === 'total' || typeof amount !== 'number' || amount <= 0) return false;
    const def = findDef(key, defs);
    return def?.target === 'labor' && def.bonusFrequency === 'high';
  });
}

/** 種別ごとの労働対価支給回数（lookback 期間内） */
export function countTypeLaborPayments(
  records: readonly BonusRecordInPeriod[],
  type: string,
): number {
  return records.filter((r) => laborAmountForType(r.bonusData, type) > 0).length;
}

/**
 * 種別が定時決定で12等分の対象か。
 * - high（マスタ）: 期間内に1回でも支給があれば対象
 * - low（マスタ）: 期間内の当該種別の支給が4回以上なら対象
 */
export function qualifiesTypeForTeijiBonusRemuneration(
  type: string,
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): boolean {
  const def = findDef(type, defs);
  if (!def || def.target !== 'labor') return false;
  if (!records.some((r) => laborAmountForType(r.bonusData, type) > 0)) return false;

  if (def.bonusFrequency === 'high') return true;
  return countTypeLaborPayments(records, type) >= 4;
}

/** lookback 期間で12等分対象となる賞与種別（type キー） */
export function getTeijiEligibleBonusTypes(
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): ReadonlySet<string> {
  const types = new Set<string>();
  for (const def of defs) {
    if (qualifiesTypeForTeijiBonusRemuneration(def.type, records, defs)) {
      types.add(def.type);
    }
  }
  return types;
}

/**
 * 定時決定で賞与を12等分して報酬月額に加算するか（従業員単位）。
 * 12等分対象の種別が1つでもあれば true。
 */
export function qualifiesForTeijiBonusRemuneration(
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): boolean {
  return getTeijiEligibleBonusTypes(records, defs).size > 0;
}

/** 12等分の合計対象額（種別ごとの対象判定を満たす金額のみ） */
export function sumTeijiEligibleLaborBonusAmount(
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): number {
  const eligibleTypes = getTeijiEligibleBonusTypes(records, defs);
  if (eligibleTypes.size === 0) return 0;

  return records.reduce((sum, record) => {
    const recordSum = [...eligibleTypes].reduce(
      (typeSum, type) => typeSum + laborAmountForType(record.bonusData, type),
      0,
    );
    return sum + recordSum;
  }, 0);
}

export function calculateBonusRemunerationAddition(
  records: readonly BonusRecordInPeriod[],
  defs: readonly BonusTypeDefinition[],
): number {
  const total = sumTeijiEligibleLaborBonusAmount(records, defs);
  if (total <= 0) return 0;
  return Math.floor(total / 12);
}

export function buildTeijiApplicationMonthKeys(teijiYear: number): string[] {
  return buildBonusRelatedRemunerationApplicationMonthKeys(teijiYear, `${teijiYear}-09`);
}

/**
 * bonusRelatedRemuneration を月次へ反映する対象月。
 * 定時決定は9月〜翌8月。7・8月適用の随時改定はそれぞれ7月・8月から翌8月まで。
 */
export function buildBonusRelatedRemunerationApplicationMonthKeys(
  teijiYear: number,
  effectiveFrom: string,
): string[] {
  const endYm = `${teijiYear + 1}-08`;
  const keys: string[] = [];
  let ym = effectiveFrom;
  while (ym <= endYm) {
    keys.push(ym);
    ym = addMonths(ym, 1);
  }
  return keys;
}

export function parseMonthFromYyyyMm(yyyyMm: string): number {
  return Number(yyyyMm.slice(5, 7));
}

/** 7・8・9月適用の随時改定（定時決定に代わる特例） */
export function isTeijiReplacementZuijiEffectiveMonth(effectiveFrom: string): boolean {
  const month = parseMonthFromYyyyMm(effectiveFrom);
  return month === 7 || month === 8 || month === 9;
}

/** 7・8・9月適用の随時改定に対応する定時決定の対象年 */
export function teijiYearFromEffectiveMonth(effectiveFrom: string): number {
  return Number(effectiveFrom.slice(0, 4));
}

export function isBonusRelatedRemunerationUnset(
  value: number | undefined | null,
): boolean {
  return value == null;
}

/** 標準報酬算定用に、全月へ同一の bonusRelatedRemuneration を適用したコピーを返す */
export function withBonusRelatedRemuneration(
  sources: readonly MonthlyRemunerationSource[],
  bonusRelatedRemuneration: number,
): MonthlyRemunerationSource[] {
  return sources.map((s) => ({ ...s, bonusRelatedRemuneration }));
}

export function applyBonusRemunerationAddition(
  months: readonly MonthPaymentBaseInput[],
  monthlyAddition: number,
): MonthPaymentBaseInput[] {
  if (monthlyAddition <= 0) return [...months];
  return months.map((m) => ({
    ...m,
    remuneration: m.remuneration + monthlyAddition,
  }));
}

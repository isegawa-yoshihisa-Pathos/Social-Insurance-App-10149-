import type { BonusData, BonusTypeDefinition } from '../../bonus-document';
import type { MonthPaymentBaseInput } from './payment-base-days';

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

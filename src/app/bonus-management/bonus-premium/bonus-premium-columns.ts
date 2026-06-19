import { BonusListColumnKey } from '../bonus-list/bonus-list-columns';

export const PREMIUM_BONUS_LIST_COLUMN_KEYS = [
  'standardBonusHealth',
  'standardBonusPension',
  'healthInsuranceEmployee',
  'healthInsuranceEmployer',
  'careInsuranceEmployee',  
  'careInsuranceEmployer',
  'pensionInsuranceEmployee',
  'pensionInsuranceEmployer',
] as const;

export type PremiumBonusListColumnKey = (typeof PREMIUM_BONUS_LIST_COLUMN_KEYS)[number];

export const PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS = [
  'healthInsuranceEmployee',
  'careInsuranceEmployee',
  'pensionInsuranceEmployee',
] as const;

export type PremiumBonusListEmployeeColumnKey =
  (typeof PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS)[number];

const PREMIUM_COLUMN_LABELS: Record<PremiumBonusListColumnKey, string> = {
  standardBonusHealth: '標準賞与額（健保）',
  standardBonusPension: '標準賞与額（厚年）',
  healthInsuranceEmployee: '健保（本人）',
  healthInsuranceEmployer: '健保（事業主）',
  careInsuranceEmployee: '介護（本人）',
  careInsuranceEmployer: '介護（事業主）',
  pensionInsuranceEmployee: '厚年（本人）',
  pensionInsuranceEmployer: '厚年（事業主）',
};

export function isPremiumColumn(column: BonusListColumnKey): column is PremiumBonusListColumnKey {
  return (PREMIUM_BONUS_LIST_COLUMN_KEYS as readonly string[]).includes(column);
}

export function getPremiumColumnLabel(column: PremiumBonusListColumnKey): string {
  return PREMIUM_COLUMN_LABELS[column];
}

export function getOptionalPremiumColumns(): { key: PremiumBonusListColumnKey; label: string }[] {
  return PREMIUM_BONUS_LIST_COLUMN_KEYS.map((key) => ({
    key,
    label: PREMIUM_COLUMN_LABELS[key],
  }));
}

export function getOptionalEmployeePremiumColumns(): {
  key: PremiumBonusListEmployeeColumnKey;
  label: string;
}[] {
  return PREMIUM_BONUS_LIST_EMPLOYEE_COLUMN_KEYS.map((key) => ({
    key,
    label: PREMIUM_COLUMN_LABELS[key],
  }));
}
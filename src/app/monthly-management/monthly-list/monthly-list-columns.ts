import {
  BONUS_TYPE_LABELS,
  BonusMap,
  MonthlyFormData,
  STORED_BONUS_TYPES,
  StoredBonusType,
} from '../../monthly-document';
import { bonusColumnKey } from './bonus-display.util';

export type MonthlyFormColumnKey = keyof MonthlyFormData;

export type BonusColumnKey = `bonus_${StoredBonusType}`;

export type MonthlyListColumnKey = MonthlyFormColumnKey | BonusColumnKey;

export const ALL_MONTHLY_LIST_COLUMN_KEYS: readonly MonthlyListColumnKey[] = [
  'displayName',
  'totalPay',
  'basicSalary',
  'overtimePay',
  'commuterAllowance',
  'otherAllowance',
  'retroactivePay',
  'bonus',
  ...STORED_BONUS_TYPES.map((t) => bonusColumnKey(t)),
  'healthInsurance_employer',
  'healthInsurance_employee',
  'careInsurance_employer',
  'careInsurance_employee',
  'pensionInsurance_employer',
  'pensionInsurance_employee',
] as const;

export const DEFAULT_MONTHLY_LIST_COLUMNS: MonthlyListColumnKey[] = [
  'displayName',
  'totalPay',
];

const BONUS_OPTIONAL_COLUMNS: { key: BonusColumnKey; label: string }[] =
  STORED_BONUS_TYPES.map((type) => ({
    key: bonusColumnKey(type),
    label: BONUS_TYPE_LABELS[type],
  }));

export const OPTIONAL_MONTHLY_LIST_COLUMNS: {
  key: Exclude<MonthlyListColumnKey, 'displayName'>;
  label: string;
}[] = [
  { key: 'basicSalary', label: '基本給与' },
  { key: 'overtimePay', label: '残業手当' },
  { key: 'commuterAllowance', label: '通勤手当' },
  { key: 'otherAllowance', label: 'その他手当' },
  { key: 'retroactivePay', label: '遡及清算' },
  { key: 'bonus', label: '賞与（合計・内訳）' },
  ...BONUS_OPTIONAL_COLUMNS,
  { key: 'healthInsurance_employer', label: '健康保険料（事業主負担）' },
  { key: 'healthInsurance_employee', label: '健康保険料（被保険者負担）' },
  { key: 'careInsurance_employer', label: '介護保険料（事業主負担）' },
  { key: 'careInsurance_employee', label: '介護保険料（被保険者負担）' },
  { key: 'pensionInsurance_employer', label: '厚生年金保険料（事業主負担）' },
  { key: 'pensionInsurance_employee', label: '厚生年金保険料（被保険者負担）' },
];

export const MONTHLY_LIST_COLUMN_LABELS: Record<MonthlyListColumnKey, string> = {
  displayName: '氏名',
  totalPay: '総支給額',
  basicSalary: '基本給与',
  overtimePay: '残業手当',
  commuterAllowance: '通勤手当',
  otherAllowance: 'その他手当',
  retroactivePay: '遡及清算',
  bonus: '賞与',
  bonus_annual: BONUS_TYPE_LABELS.annual,
  bonus_term_end: BONUS_TYPE_LABELS.term_end,
  bonus_incentive: BONUS_TYPE_LABELS.incentive,
  bonus_allowance: BONUS_TYPE_LABELS.allowance,
  bonus_special: BONUS_TYPE_LABELS.special,
  bonus_other: BONUS_TYPE_LABELS.other,
  healthInsurance_employer: '健康保険料（事業主負担）',
  healthInsurance_employee: '健康保険料（被保険者負担）',
  careInsurance_employer: '介護保険料（事業主負担）',
  careInsurance_employee: '介護保険料（被保険者負担）',
  pensionInsurance_employer: '厚生年金保険料（事業主負担）',
  pensionInsurance_employee: '厚生年金保険料（被保険者負担）',
};

export interface MonthlyListRow {
  eid: string;
  displayName: string;
  totalPay: number;
  basicSalary: number;
  overtimePay: number | null;
  commuterAllowance: number | null;
  otherAllowance: number | null;
  retroactivePay: number | null;
  bonus: BonusMap;
  bonusDisplay: string;
  bonusTooltip: string;
  bonusTotal: number;
  healthInsurance_employer: number;
  healthInsurance_employee: number;
  careInsurance_employer: number | null;
  careInsurance_employee: number | null;
  pensionInsurance_employer: number;
  pensionInsurance_employee: number;
}

import { BonusTypeDefinition, BonusDocument } from '../../bonus-document';
import { bonusTypeFromColumnKey } from './bonus-display.util';
import { extractBonusAmounts } from './bonus-data.util';
import { BONUS_NET_PAYMENT_COLUMN_KEY } from './bonus-list-columns';
import { bonusEmployerPremium, bonusNetPayment } from '../../../../shared/payment-summary.util';

function toBonusPremiumInput(row: BonusListRow) {
  return {
    bonus: row.bonus,
    bonusHealthInsuranceEmployee: row.healthInsuranceEmployee,
    bonusCareInsuranceEmployee: row.careInsuranceEmployee,
    bonusPensionInsuranceEmployee: row.pensionInsuranceEmployee,
    bonusHealthInsuranceEmployer: row.healthInsuranceEmployer,
    bonusCareInsuranceEmployer: row.careInsuranceEmployer,
    bonusPensionInsuranceEmployer: row.pensionInsuranceEmployer,
  };
}

function bonusRowNetPayment(row: BonusListRow): number {
  return bonusNetPayment(toBonusPremiumInput(row));
}

export function bonusListEmployerBurden(row: BonusListRow): number {
  return bonusEmployerPremium(toBonusPremiumInput(row));
}
import { BulkEditValue } from './bonus-bulk-edit.types';
import { BonusListColumnKey, BonusListRow } from './bonus-list-columns';
import { Format } from '../../format-number-jp';
import { isPremiumColumn } from '../bonus-premium/bonus-premium-columns';
import { applyPremiumFieldsToRow, formatPremiumCellValue, premiumSortValue, premiumSearchText } from '../bonus-premium/bonus-premium-row.mapper';

export function toBonusListRow(
  eid: string,
  data: Partial<BonusDocument>,
  _bonusTypeDefinitions: BonusTypeDefinition[],
): BonusListRow {
  const bonus = data.bonusData ? extractBonusAmounts(data.bonusData) : {};

  return {
    ...applyPremiumFieldsToRow({
      eid,
      employeeId: '',
      displayName: data.displayName ?? '',
      bonus,
    } as BonusListRow, data),
  };
}

export function bonusListNumericValue(
  row: BonusListRow,
  column: BonusListColumnKey,
): number | null {
  const value = bonusListSortValue(row, column);
  return typeof value === 'number' ? value : null;
}

export function isSummableBonusListColumn(
  column: BonusListColumnKey,
): boolean {
  return column !== 'displayName' && column !== 'employeeId';
}

export function getBonusListEditValue(
  row: BonusListRow,
  column: BonusListColumnKey,
): BulkEditValue {
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? null : amount;
  }

  const value = row[column as keyof BonusListRow];
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  return null;
}

export function formatBonusListCellValue(
  row: BonusListRow,
  column: BonusListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return formatPremiumCellValue(row, column);
  }

  if (column === BONUS_NET_PAYMENT_COLUMN_KEY) {
    const amount = bonusRowNetPayment(row);
    return amount === 0 ? '' : Format(amount);
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  if (column === 'displayName' || column === 'employeeId') {
    return String(row[column] ?? '');
  }

  const value = row[column as keyof BonusListRow];
  if (value == null) return '';
  return Format(value as number);
}

export function bonusListSortValue(
  row: BonusListRow,
  column: BonusListColumnKey,
): string | number {
  if (isPremiumColumn(column)) {
    return premiumSortValue(row, column);
  }

  if (column === BONUS_NET_PAYMENT_COLUMN_KEY) {
    return bonusRowNetPayment(row);
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return row.bonus[bonusType] ?? 0;
  }

  const value = row[column as keyof BonusListRow];
  if (typeof value === 'number') return value;

  if (value == null) return '';
  return String(value);
}

export type BonusDetailColumnKey = BonusListColumnKey | 'yyyyMm';

export function bonusDetailSearchText(
  row: { yyyyMm: string } & BonusListRow,
  column: BonusDetailColumnKey,
): string {
  if (column === 'yyyyMm') {
    const [year, month] = row.yyyyMm.split('-');
    return `${row.yyyyMm} ${year}年${parseInt(month, 10)}月`;
  }
  return bonusListSearchText(row, column);
}

export function bonusListSearchText(
  row: BonusListRow,
  column: BonusListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return premiumSearchText(row, column);
  }

  if (column === BONUS_NET_PAYMENT_COLUMN_KEY) {
    const amount = bonusRowNetPayment(row);
    return amount === 0 ? '' : Format(amount);
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : formatBonusListCellValue(row, column);
  }
  const value = row[column as keyof BonusListRow];
  return value == null ? '' : String(value);
}

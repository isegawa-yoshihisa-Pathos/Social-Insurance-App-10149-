import { BonusTypeDefinition, BonusDocument } from '../../bonus-document';
import {
  buildBonusDisplayParts,
  bonusTypeFromColumnKey,
} from './bonus-display.util';
import { extractBonusAmounts } from './bonus-data.util';
import { BulkEditValue } from './bonus-bulk-edit.types';
import { BonusListColumnKey, BonusListRow } from './bonus-list-columns';
import { Format } from '../../format-number-jp';
import { isPremiumColumn } from '../bonus-premium/bonus-premium-columns';
import { applyPremiumFieldsToRow, formatPremiumCellValue, premiumSortValue, premiumSearchText } from '../bonus-premium/bonus-premium-row.mapper';

export function toBonusListRow(
  eid: string,
  data: Partial<BonusDocument>,
  bonusTypeDefinitions: BonusTypeDefinition[],
): BonusListRow {
  const bonus = data.bonusData ? extractBonusAmounts(data.bonusData) : {};
  const bonusParts = buildBonusDisplayParts(bonus, bonusTypeDefinitions);

  return {
    ...applyPremiumFieldsToRow({
      eid,
      employeeId: '',
      displayName: data.displayName ?? '',
      bonus,
      bonusDisplay: bonusParts.display,
      bonusTooltip: bonusParts.tooltip,
      bonusTotal: bonusParts.total,
    } as BonusListRow, data),
  };
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

  if (column === 'bonus') {
    return row.bonusTotal === 0 ? '' : Format(row.bonusTotal);
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

  if (column === 'bonus') {
    return row.bonusTotal;
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

export function bonusListSearchText(
  row: BonusListRow,
  column: BonusListColumnKey,
): string {
  if (isPremiumColumn(column)) {
    return premiumSearchText(row, column);
  }

  if (column === 'bonus') {
    return row.bonusDisplay;
  }
  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : formatBonusListCellValue(row, column);
  }
  const value = row[column as keyof BonusListRow];
  return value == null ? '' : String(value);
}
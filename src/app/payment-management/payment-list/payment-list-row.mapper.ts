import { BonusTypeDefinition } from '../../bonus-document';
import { AllowanceTypeDefinition } from '../../payment-document';
import { MonthlyDocument } from '../../monthly-document';
import { BonusDocument } from '../../bonus-document';
import {
  allowanceTypeForPaymentColumn,
  bonusTypeForPaymentColumn,
  PaymentListColumnKey,
  PaymentListRow,
} from './payment-list-columns';
import { Format } from '../../format-number-jp';
import { isPremiumColumn } from '../payment-premium/payment-premium-columns';
import {
  applyMonthlyPremiumFieldsToRow,
  applyBonusPremiumFieldsToRow,
  formatPremiumCellValue,
  premiumSortValue,
  premiumSearchText,
} from '../payment-premium/payment-premium-row.mapper';
import { extractBonusAmounts } from '../../bonus-management/bonus-list/bonus-data.util';

export function toPaymentListRow(
  eid: string,
  monthlyData: Partial<MonthlyDocument> | undefined,
  bonusData: Partial<BonusDocument> | undefined,
): PaymentListRow {
  const payroll = monthlyData?.payrollData;
  const bonus = bonusData?.bonusData ? extractBonusAmounts(bonusData.bonusData) : {};
  const bonusTotal = Object.values(bonus).reduce((sum, amount) => sum + (amount ?? 0), 0);

  const baseRow: PaymentListRow = {
    eid,
    employeeId: '',
    displayName: monthlyData?.displayName ?? bonusData?.displayName ?? '',
    paymentBaseDays: monthlyData?.paymentBaseDays ?? 0,
    basicSalary: payroll?.basicSalary ?? 0,
    fringeBenefits: payroll?.fringeBenefits ?? 0,
    fixedWage: payroll?.fixedWage ?? null,
    variableWage: payroll?.variableWage ?? null,
    allowances: payroll?.allowances ?? {},
    retroactivePay: payroll?.retroactivePay ?? null,
    bonus,
    bonusTotal,
    standardRemunerationHealth: null,
    standardRemunerationPension: null,
    healthInsuranceEmployee: null,
    healthInsuranceEmployer: null,
    careInsuranceEmployee: null,
    careInsuranceEmployer: null,
    pensionInsuranceEmployee: null,
    pensionInsuranceEmployer: null,
    standardBonusHealth: null,
    standardBonusPension: null,
    bonusHealthInsuranceEmployee: null,
    bonusHealthInsuranceEmployer: null,
    bonusCareInsuranceEmployee: null,
    bonusCareInsuranceEmployer: null,
    bonusPensionInsuranceEmployee: null,
    bonusPensionInsuranceEmployer: null,
  };

  return applyBonusPremiumFieldsToRow(
    applyMonthlyPremiumFieldsToRow(baseRow, monthlyData ?? {}),
    bonusData ?? {},
  );
}

export function paymentListNumericValue(
  row: PaymentListRow,
  column: PaymentListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): number | null {
  const value = paymentListSortValue(row, column, allowanceDefinitions, bonusDefinitions);
  return typeof value === 'number' ? value : null;
}

export function isSummablePaymentListColumn(
  column: PaymentListColumnKey,
): boolean {
  return column !== 'displayName' && column !== 'employeeId';
}

export function formatPaymentListCellValue(
  row: PaymentListRow,
  column: PaymentListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): string {
  if (isPremiumColumn(column)) {
    return formatPremiumCellValue(row, column);
  }

  if (column === 'displayName' || column === 'employeeId') {
    return String(row[column] ?? '');
  }

  if (column === 'bonus') {
    return row.bonusTotal === 0 ? '' : Format(row.bonusTotal);
  }

  const bonusType = bonusTypeForPaymentColumn(column, bonusDefinitions);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const allowanceType = allowanceTypeForPaymentColumn(column, allowanceDefinitions);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const value = row[column as keyof PaymentListRow];
  if (value == null) return '';
  if (typeof value === 'number') return Format(value);
  return String(value);
}

export function paymentListSortValue(
  row: PaymentListRow,
  column: PaymentListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): string | number {
  if (isPremiumColumn(column)) {
    return premiumSortValue(row, column);
  }

  if (column === 'bonus') {
    return row.bonusTotal;
  }

  const bonusType = bonusTypeForPaymentColumn(column, bonusDefinitions);
  if (bonusType) {
    return row.bonus[bonusType] ?? 0;
  }

  const allowanceType = allowanceTypeForPaymentColumn(column, allowanceDefinitions);
  if (allowanceType) {
    return row.allowances[allowanceType] ?? 0;
  }

  const value = row[column as keyof PaymentListRow];
  if (typeof value === 'number') return value;
  if (value == null) return '';
  return String(value);
}

export function paymentListSearchText(
  row: PaymentListRow,
  column: PaymentListColumnKey,
  allowanceDefinitions: AllowanceTypeDefinition[],
  bonusDefinitions: BonusTypeDefinition[],
): string {
  if (isPremiumColumn(column)) {
    return premiumSearchText(row, column);
  }

  if (column === 'bonus') {
    return row.bonusTotal === 0 ? '' : Format(row.bonusTotal);
  }

  const bonusType = bonusTypeForPaymentColumn(column, bonusDefinitions);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const allowanceType = allowanceTypeForPaymentColumn(column, allowanceDefinitions);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const value = row[column as keyof PaymentListRow];
  return value == null ? '' : String(value);
}

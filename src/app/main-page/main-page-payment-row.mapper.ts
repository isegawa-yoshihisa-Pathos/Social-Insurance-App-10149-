import { AllowanceTypeDefinition } from '../payment-document';
import {
  BonusListColumnKeyForEmployee,
  BonusListRow,
  BonusListRowForEmployee,
  BONUS_TOTAL_PAYMENT_COLUMN_KEY,
} from '../bonus-management/bonus-list/bonus-list-columns';
import {
  MonthlyListColumnKeyForEmployee,
  MonthlyListRow,
  MonthlyListRowForEmployee,
  MONTHLY_TOTAL_PAYMENT_COLUMN_KEY,
} from '../monthly-management/monthly-list/monthly-list-columns';
import { allowanceTypeFromColumnKey } from '../payment-management/payment-list/allowance-display.util';
import { bonusTypeFromColumnKey } from '../bonus-management/bonus-list/bonus-display.util';
import { Format } from '../format-number-jp';
import { bonusNetPayment, monthlyNetPayment } from '../../../shared/payment-summary.util';
import { paymentListMonthlyNetPayment } from '../payment-management/payment-list/payment-list-summary.util';
import type { PaymentListRow } from '../payment-management/payment-list/payment-list-columns';
import type { PremiumMonthlyListEmployeeColumnKey } from '../monthly-management/monthly-premium/monthly-premium-columns';
import type { PremiumBonusListEmployeeColumnKey } from '../bonus-management/bonus-premium/bonus-premium-columns';

export function toMonthlyListRowForEmployeeFromPaymentRow(
  row: PaymentListRow,
): MonthlyListRowForEmployee {
  return {
    totalPayment: paymentListMonthlyNetPayment(row),
    basicSalary: row.basicSalary,
    fringeBenefits: row.fringeBenefits,
    bonusRelatedRemuneration: row.bonusRelatedRemuneration,
    allowances: row.allowances,
    retroactivePay: row.retroactivePay,
    healthInsuranceEmployee: row.healthInsuranceEmployee,
    careInsuranceEmployee: row.careInsuranceEmployee,
    pensionInsuranceEmployee: row.pensionInsuranceEmployee,
  };
}

/** @deprecated toMonthlyListRowForEmployeeFromPaymentRow を使用 */
export function toMonthlyListRowForEmployee(row: MonthlyListRow): MonthlyListRowForEmployee {
  return {
    totalPayment: monthlyNetPayment(row, row),
    basicSalary: row.basicSalary,
    fringeBenefits: row.fringeBenefits,
    bonusRelatedRemuneration: row.bonusRelatedRemuneration,
    allowances: row.allowances,
    retroactivePay: row.retroactivePay,
    healthInsuranceEmployee: row.healthInsuranceEmployee,
    careInsuranceEmployee: row.careInsuranceEmployee,
    pensionInsuranceEmployee: row.pensionInsuranceEmployee,
  };
}

export function toBonusListRowForEmployee(row: BonusListRow): BonusListRowForEmployee {
  return {
    totalPayment: bonusNetPayment({
      bonus: row.bonus,
      bonusHealthInsuranceEmployee: row.healthInsuranceEmployee,
      bonusCareInsuranceEmployee: row.careInsuranceEmployee,
      bonusPensionInsuranceEmployee: row.pensionInsuranceEmployee,
      bonusHealthInsuranceTotal: row.healthInsuranceTotal,
      bonusCareInsuranceTotal: row.careInsuranceTotal,
      bonusPensionInsuranceTotal: row.pensionInsuranceTotal,
    }),
    bonus: row.bonus,
    healthInsuranceEmployee: row.healthInsuranceEmployee,
    careInsuranceEmployee: row.careInsuranceEmployee,
    pensionInsuranceEmployee: row.pensionInsuranceEmployee,
  };
}

export function formatMonthlyEmployeeCellValue(
  row: MonthlyListRowForEmployee,
  column: MonthlyListColumnKeyForEmployee,
  _allowanceDefinitions: AllowanceTypeDefinition[] = [],
): string {
  if (
    column === 'healthInsuranceEmployee'
    || column === 'careInsuranceEmployee'
    || column === 'pensionInsuranceEmployee'
  ) {
    const value = row[column as PremiumMonthlyListEmployeeColumnKey];
    return value == null ? '' : Format(value);
  }

  if (column === MONTHLY_TOTAL_PAYMENT_COLUMN_KEY) {
    const amount = row.totalPayment;
    return amount === 0 ? '' : Format(amount);
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    const amount = row.allowances[allowanceType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  const value = row[column as Exclude<
    keyof MonthlyListRowForEmployee,
    'totalPayment' | 'allowances'
  >];
  if (value == null) return '';
  return Format(value as number);
}

export function formatBonusEmployeeCellValue(
  row: BonusListRowForEmployee,
  column: BonusListColumnKeyForEmployee,
): string {
  if (
    column === 'healthInsuranceEmployee'
    || column === 'careInsuranceEmployee'
    || column === 'pensionInsuranceEmployee'
  ) {
    const value = row[column as PremiumBonusListEmployeeColumnKey];
    return value == null ? '' : Format(value);
  }

  if (column === BONUS_TOTAL_PAYMENT_COLUMN_KEY) {
    const amount = row.totalPayment;
    return amount === 0 ? '' : Format(amount);
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    const amount = row.bonus[bonusType] ?? 0;
    return amount === 0 ? '' : Format(amount);
  }

  return '';
}

export function monthlyEmployeeExportValue(
  row: MonthlyListRowForEmployee,
  column: MonthlyListColumnKeyForEmployee,
): number | string {
  if (column === MONTHLY_TOTAL_PAYMENT_COLUMN_KEY) {
    return row.totalPayment;
  }

  const allowanceType = allowanceTypeFromColumnKey(column);
  if (allowanceType) {
    return row.allowances[allowanceType] ?? 0;
  }

  if (
    column === 'healthInsuranceEmployee'
    || column === 'careInsuranceEmployee'
    || column === 'pensionInsuranceEmployee'
  ) {
    return row[column] ?? 0;
  }

  const value = row[column as Exclude<keyof MonthlyListRowForEmployee, 'totalPayment' | 'allowances'>];
  if (typeof value === 'number') {
    return value;
  }
  return 0;
}

export function bonusEmployeeExportValue(
  row: BonusListRowForEmployee,
  column: BonusListColumnKeyForEmployee,
): number | string {
  if (column === BONUS_TOTAL_PAYMENT_COLUMN_KEY) {
    return row.totalPayment;
  }

  const bonusType = bonusTypeFromColumnKey(column);
  if (bonusType) {
    return row.bonus[bonusType] ?? 0;
  }

  if (
    column === 'healthInsuranceEmployee'
    || column === 'careInsuranceEmployee'
    || column === 'pensionInsuranceEmployee'
  ) {
    return row[column] ?? 0;
  }

  return '';
}

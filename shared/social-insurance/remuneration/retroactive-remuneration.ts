import type { PayrollData } from '../../monthly-document';
import type { MonthlyRemunerationSource } from './remuneration-month-input';
import type { AnnualAverageMonthInput } from './annual-average-determination';
import { computeFixedWageFromPayroll } from './fixed-wage';

export type RetroactiveWageKind = 'fixed' | 'variable';

export interface RetroactivePayDetectedItem {
  paymentYyyyMm: string;
  amount: number;
}

export interface RetroactiveAllocationLine {
  targetYyyyMm: string;
  amount: number;
  wageKind: RetroactiveWageKind;
}

/** @deprecated 読み取り時の後方互換用。新規保存では使用しない。 */
export type RetroactivePayReviewItemLegacy = RetroactivePayReviewItem & {
  wageKind?: RetroactiveWageKind;
};

export interface RetroactivePayReviewItem {
  paymentYyyyMm: string;
  amount: number;
  included: boolean;
  allocations: RetroactiveAllocationLine[];
}

export interface RetroactiveAdjustmentByMonth {
  fixed: number;
  variable: number;
}

export function defaultRetroactiveReviewItem(
  detected: RetroactivePayDetectedItem,
): RetroactivePayReviewItem {
  return {
    paymentYyyyMm: detected.paymentYyyyMm,
    amount: detected.amount,
    included: true,
    allocations: [
      {
        targetYyyyMm: detected.paymentYyyyMm,
        amount: detected.amount,
        wageKind: 'fixed',
      },
    ],
  };
}

export function normalizeRetroactiveReviewItem(
  item: RetroactivePayReviewItemLegacy,
): RetroactivePayReviewItem {
  const fallbackKind = item.wageKind ?? 'fixed';
  return {
    paymentYyyyMm: item.paymentYyyyMm,
    amount: item.amount,
    included: item.included,
    allocations: item.allocations.map((line) => ({
      targetYyyyMm: line.targetYyyyMm,
      amount: line.amount,
      wageKind: line.wageKind ?? fallbackKind,
    })),
  };
}

export function normalizeRetroactiveReviewItems(
  items: readonly RetroactivePayReviewItemLegacy[],
): RetroactivePayReviewItem[] {
  return items.map((item) => normalizeRetroactiveReviewItem(item));
}

export function validateRetroactiveReviewItems(items: readonly RetroactivePayReviewItem[]): string | null {
  for (const item of items) {
    if (!item.included) continue;
    if (item.amount <= 0) {
      return '遡及支払額が不正です。';
    }
    if (item.allocations.length === 0) {
      return `${item.paymentYyyyMm} の配分先がありません。`;
    }
    const sum = item.allocations.reduce((s, line) => s + (line.amount ?? 0), 0);
    if (sum <= 0) {
      return `${item.paymentYyyyMm} の配分合計は1円以上にしてください。`;
    }
    if (sum > item.amount) {
      return `${item.paymentYyyyMm} の配分合計（${sum}円）が遡及額（${item.amount}円）を超えています。`;
    }
    for (const line of item.allocations) {
      if (!line.targetYyyyMm || line.amount <= 0) {
        return '配分先の月と金額を正しく入力してください。';
      }
      if (line.wageKind !== 'fixed' && line.wageKind !== 'variable') {
        return '各配分行の賃金区分を選択してください。';
      }
    }
  }
  const included = items.filter((i) => i.included);
  if (included.length === 0) {
    return '再計算に含める遡及支払を1件以上選択してください。';
  }
  return null;
}

export function buildRetroactiveAdjustmentsByMonth(
  items: readonly RetroactivePayReviewItem[],
): Map<string, RetroactiveAdjustmentByMonth> {
  const map = new Map<string, RetroactiveAdjustmentByMonth>();

  for (const item of items) {
    if (!item.included) continue;
    for (const line of item.allocations) {
      if (line.amount <= 0) continue;
      const current = map.get(line.targetYyyyMm) ?? { fixed: 0, variable: 0 };
      if (line.wageKind === 'fixed') {
        current.fixed += line.amount;
      } else {
        current.variable += line.amount;
      }
      map.set(line.targetYyyyMm, current);
    }
  }

  return map;
}

function applyAdjustmentToPayroll(
  payroll: PayrollData,
  adjustment: RetroactiveAdjustmentByMonth,
): PayrollData {
  if (adjustment.fixed === 0 && adjustment.variable === 0) {
    return payroll;
  }

  const next: PayrollData = { ...payroll, allowances: { ...payroll.allowances } };
  if (adjustment.fixed > 0) {
    const base = next.fixedWage ?? computeFixedWageFromPayroll(next);
    next.fixedWage = base + adjustment.fixed;
  }
  if (adjustment.variable > 0) {
    next.variableWage = (next.variableWage ?? 0) + adjustment.variable;
  }
  return next;
}

export function applyRetroactiveToMonthlySource(
  source: MonthlyRemunerationSource,
  adjustmentsByMonth: ReadonlyMap<string, RetroactiveAdjustmentByMonth>,
): MonthlyRemunerationSource {
  const adjustment = adjustmentsByMonth.get(source.yyyyMm);
  if (!adjustment) {
    return source;
  }
  return {
    ...source,
    payroll: applyAdjustmentToPayroll(source.payroll, adjustment),
  };
}

export function applyRetroactiveToMonthlySources(
  sources: readonly MonthlyRemunerationSource[],
  items: readonly RetroactivePayReviewItem[],
): MonthlyRemunerationSource[] {
  const adjustments = buildRetroactiveAdjustmentsByMonth(items);
  return sources.map((source) => applyRetroactiveToMonthlySource(source, adjustments));
}

export function applyRetroactiveToAnnualInputs(
  inputs: readonly AnnualAverageMonthInput[],
  items: readonly RetroactivePayReviewItem[],
): AnnualAverageMonthInput[] {
  const adjustments = buildRetroactiveAdjustmentsByMonth(items);
  return inputs.map((input) => {
    const adjustment = adjustments.get(input.yyyyMm);
    if (!adjustment) return input;
    return {
      ...input,
      payroll: applyAdjustmentToPayroll(input.payroll, adjustment),
    };
  });
}

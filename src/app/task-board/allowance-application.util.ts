export interface AllowanceApplicationFormData {
  allowanceType: string;
  applyYyyyMm: string;
  amount: number | null;
  reason: string;
}

export function createEmptyAllowanceApplicationForm(): AllowanceApplicationFormData {
  return {
    allowanceType: '',
    applyYyyyMm: '',
    amount: null,
    reason: '',
  };
}

/** 適用月の選択肢（前後12ヶ月）を yyyy-MM 形式で生成 */
export function buildApplyMonthOptions(baseDate = new Date()): string[] {
  const options: string[] = [];
  for (let offset = -6; offset <= 12; offset += 1) {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    options.push(`${year}-${month}`);
  }
  return options;
}

export function formatApplyMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  if (!year || !month) {
    return yyyyMm;
  }
  return `${year}年${parseInt(month, 10)}月`;
}

export function validateAllowanceApplicationForm(
  form: AllowanceApplicationFormData,
): string | null {
  if (!form.allowanceType.trim()) {
    return '手当の種類を選択してください。';
  }
  if (!/^\d{4}-\d{2}$/.test(form.applyYyyyMm)) {
    return '適用月を選択してください。';
  }
  if (form.amount == null || !Number.isFinite(form.amount) || form.amount <= 0) {
    return '金額は1円以上で入力してください。';
  }
  if (!Number.isInteger(form.amount)) {
    return '金額は整数で入力してください。';
  }
  return null;
}

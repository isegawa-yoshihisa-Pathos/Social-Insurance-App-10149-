export function toFormDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function getAgeAttainmentYyyyMm(birthDate: Date, age: number): string {
  const birthdayOfAge = new Date(
    birthDate.getFullYear() + age,
    birthDate.getMonth(),
    birthDate.getDate()
  );
  
  const attainmentDate = new Date(birthdayOfAge);
  attainmentDate.setDate(birthdayOfAge.getDate() - 1);

  const yyyy = attainmentDate.getFullYear();
  const mm = String(attainmentDate.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function checkLicense(params: {
  licenseStartAt: Date | null | undefined;
  yyyyMm: string;
}): boolean {
  const { licenseStartAt, yyyyMm } = params;
  if (!licenseStartAt) return false;
  const licenseStartAtYyyyMm = `${licenseStartAt.getFullYear()}-${String(licenseStartAt.getMonth() + 1).padStart(2, '0')}`;
  if (licenseStartAtYyyyMm > yyyyMm) return false;
  return true;
}

export function checkResignationPremiumCollection(params: {
  licenseStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  yyyyMm: string;
  collectionTiming: 'currentMonth' | 'nextMonth' | 'nextNextMonth';
}): {
  shouldCollectTwoMonths: boolean;
  isSameMonthAcquireAndResign: boolean;
  reasonMessage: string;
} {
  const { licenseStartAt, resignAt, yyyyMm, collectionTiming } = params;

  // 退職日がなければ通常の計算（2ヶ月徴収は不要）
  if (!resignAt) {
    return { shouldCollectTwoMonths: false, isSameMonthAcquireAndResign: false, reasonMessage: '' };
  }

  // 退職日の「翌日」が社会保険の資格喪失日
  const lossDate = new Date(resignAt.getTime());
  lossDate.setDate(lossDate.getDate() + 1);

  // 給与支給月をDateオブジェクトに変換
  const currentPayDate = new Date(`${yyyyMm}-01`);
  
  // 退職日（喪失日）と支給月が一致している「最終給与計算」であるかチェック
  const isFinalSalaryMonth = 
    resignAt.getFullYear() === currentPayDate.getFullYear() &&
    resignAt.getMonth() === currentPayDate.getMonth();

  if (!isFinalSalaryMonth) {
    return { shouldCollectTwoMonths: false, isSameMonthAcquireAndResign: false, reasonMessage: '' };
  }

  // 同月内得喪の判定（取得日と退職日が同じ年月か）
  let isSameMonthAcquireAndResign = false;
  if (licenseStartAt) {
    isSameMonthAcquireAndResign = 
      licenseStartAt.getFullYear() === resignAt.getFullYear() &&
      licenseStartAt.getMonth() === resignAt.getMonth();
  }

  // --- 2ヶ月徴収の判定ロジック ---
  // 翌月徴収（'next'）かつ、退職日が「月末」の場合に2ヶ月徴収が必要となる
  // 月末退職の判定：退職日の翌日（喪失日）の「月」が、退職日の「月」と異なる場合、退職日は月末。
  const isEndOfMonthResign = resignAt.getMonth() !== lossDate.getMonth();
  
  let shouldCollectTwoMonths = false;
  let reasonMessage = '通常の1ヶ月徴収です。';

  if (collectionTiming === 'nextMonth' && isEndOfMonthResign) {
    shouldCollectTwoMonths = true;
    reasonMessage = '月末退職かつ翌月徴収設定のため、前月分と当月分の2ヶ月分を自動徴収します。';
  } else if (isSameMonthAcquireAndResign) {
    reasonMessage = '同月内得喪（同月入退社）に該当するため、1ヶ月分の保険料が発生します。';
  } else if (!isEndOfMonthResign && collectionTiming === 'nextMonth') {
    reasonMessage = '月途中退職のため、退職月の保険料は免除されます（1ヶ月徴収）。';
  }

  return {
    shouldCollectTwoMonths,
    isSameMonthAcquireAndResign,
    reasonMessage
  };
}
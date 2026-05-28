export const MONTHLY_SEED_EIDS = [
  '1xPhzoDUSeuj5cYq1mwL',
  'CUoiFmn06wdfnkeLCDbq',
  'HRDSX0JKPXIvsyGBHWwf',
  'KRx4dxUml6rFKQ2eNZIm',
  'cyxoINgAMDSDbZOdU9hs',
  'lde0r5SXDWDzhmVAHbwt',
  'lzFoFuHub1K1levQyn4J',
  'moH9N4M9u6RaeeYs2LtY',
] as const;

export const MONTHLY_SEED_MONTHS = [
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
] as const;

import { BonusMap } from '../../monthly-document';

export interface MonthlySeedPayload {
  uid: string;
  displayName: string;
  payrollData: {
    totalPay: number;
    basicSalary: number;
    overtimePay: number | null;
    commuterAllowance: number | null;
    otherAllowance: number | null;
    retroactivePay: number | null;
  };
  bonusData?: { bonus: BonusMap };
  premiumData: {
    healthInsurance: { employer: number; employee: number };
    careInsurance: { employer: number | null; employee: number | null };
    pensionInsurance: { employer: number; employee: number };
  };
}

export function buildMonthlySeedPayload(
  displayName: string,
  uid: string,
  employeeIndex: number,
  yyyyMm: string,
): MonthlySeedPayload {
  const month = Number(yyyyMm.split('-')[1]);

  const basicSalary = 260_000 + employeeIndex * 12_000 + month * 1_500;
  const overtimePay = month % 2 === 0 ? 20_000 + employeeIndex * 2_000 : null;
  const commuterAllowance = 15_000;
  const otherAllowance = month === 3 ? 8_000 + employeeIndex * 500 : null;
  const retroactivePay = month === 1 ? 5_000 : null;

  const totalPay =
    basicSalary +
    (overtimePay ?? 0) +
    commuterAllowance +
    (otherAllowance ?? 0) +
    (retroactivePay ?? 0);

  const healthBase = Math.round(basicSalary * 0.0495);
  const pensionBase = Math.round(basicSalary * 0.0915);
  const hasCareInsurance = employeeIndex >= 4;
  const careAmount = hasCareInsurance ? Math.round(basicSalary * 0.008) : null;

  const payload: MonthlySeedPayload = {
    uid,
    displayName,
    payrollData: {
      totalPay,
      basicSalary,
      overtimePay,
      commuterAllowance,
      otherAllowance,
      retroactivePay,
    },
    premiumData: {
      healthInsurance: { employer: healthBase, employee: healthBase },
      careInsurance: { employer: careAmount, employee: careAmount },
      pensionInsurance: { employer: pensionBase, employee: pensionBase },
    },
  };

  if (month === 6) {
    const bonus: BonusMap = {
      annual: 150_000 + employeeIndex * 20_000,
    };
    if (employeeIndex % 2 === 0) {
      bonus.special = 50_000;
    }
    if (employeeIndex % 3 === 0) {
      bonus.term_end = 80_000 + employeeIndex * 5_000;
    }
    payload.bonusData = { bonus };
  }

  return payload;
}

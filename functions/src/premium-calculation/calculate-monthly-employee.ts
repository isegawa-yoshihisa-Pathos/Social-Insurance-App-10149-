import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { calculateMonthlyPremium } from '../../../shared/social-insurance/premium/premium-calculator';
import { determineInitial } from '../../../shared/social-insurance/remuneration/initial-determination';
import { determineTeiji } from '../../../shared/social-insurance/remuneration/teiji-determination';
import { determineStandardZuiji } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { PreviousGrades } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import {
  toMonthPaymentBaseInput,
  type MonthlyRemunerationSource,
} from '../../../shared/social-insurance/remuneration/remuneration-month-input';
import type { ResolvedStandardRemuneration } from '../../../shared/social-insurance/remuneration/grade-table/index';
import {
  addMonths,
  daysInMonth,
  parseYyyyMm,
} from '../../../shared/social-insurance/monthly/social-insurance-data.util';
import { toFormDate } from '../../../shared/date-utils';
import {
  getEmployee,
  getLatestStandardRemuneration,
  getMonthlyDocument,
  getStandardRemuneration,
  listStandardRemuneration,
  saveStandardRemuneration,
  resolveInsuranceRateForMonth,
  type StandardRemunerationSavePayload,
  type StandardRemunerationSource,
} from './repos';

interface CalculationContext {
  employee: EmployeeDocument;
  monthly: MonthlyDocument;
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  birthDate: Date | null;
}

export async function calculateMonthlyEmployee(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<void> {
  const ctx = await loadContext(db, tid, eid, yyyyMm);
  if (!ctx.employee.employeeEmployInfo?.licenseStartAt) {
    throw new Error('社会保険の資格取得日が設定されていません。');
  }

  const rawStandardRemuneration = await resolveStandardRemuneration(db, tid, eid, yyyyMm, ctx);

  if (rawStandardRemuneration.source !== 'carried') {
    await saveStandardRemuneration(
      db,
      tid,
      eid,
      rawStandardRemuneration.effectiveFrom,
      rawStandardRemuneration,
    );
  }

  const standardRemuneration =
    (await getLatestStandardRemuneration(db, tid, eid, yyyyMm)) ?? rawStandardRemuneration;

  const rate = await resolveInsuranceRateForMonth(db, tid, yyyyMm);
  if (!rate) return;

  const premiumData = calculateMonthlyPremium({
    yyyyMm,
    birthDate: ctx.birthDate,
    standardRemuneration: standardRemuneration.standardRemuneration,
    rates: rate.rates,
    employeeRate: rate.employeeRate,
    roundingBy: rate.roundingBy,
  });

  const calculationSnapshot = {
    rateId: rate.rateId,
    effectiveFrom: rate.effectiveFrom,
    rates: {
      health: rate.rates.healthInsuranceRate,
      care: rate.rates.careInsuranceRate,
      pension: rate.rates.pensionInsuranceRate,
    },
    employeeRate: {
      health: rate.employeeRate.healthInsurance,
      care: rate.employeeRate.careInsurance,
      pension: rate.employeeRate.pensionInsurance,
    },
    roundingBy: {
      health: rate.roundingBy.healthInsurance,
      care: rate.roundingBy.careInsurance,
      pension: rate.roundingBy.pensionInsurance,
    },
    healthGrade: standardRemuneration.healthGrade,
    pensionGrade: standardRemuneration.pensionGrade,
    standardRemuneration: standardRemuneration.standardRemuneration,
    remuneration: standardRemuneration.remuneration,
    source: standardRemuneration.source,
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection('tenants')
    .doc(tid)
    .collection('monthly-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid)
    .update({
      payrollData: { ...ctx.monthly.payrollData },
      premiumData,
      calculationSnapshot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function loadContext(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<CalculationContext> {
  const [employee, monthly] = await Promise.all([
    getEmployee(db, tid, eid),
    getMonthlyDocument(db, tid, eid, yyyyMm),
  ]);
  if (!monthly?.payrollData) {
    throw new Error(`${yyyyMm} の月次給与データがありません。`);
  }
  return {
    employee,
    monthly,
    employmentType: employee.employeeEmployInfo?.employmentType ?? 'full-time',
    birthDate: toFormDate(employee.employeePersonalInfo?.birthDate),
  };
}

async function resolveStandardRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload> {
  const existing = await getStandardRemuneration(db, tid, eid, yyyyMm);
  if (existing?.source === 'manual') return toSavePayload(existing);

  const zuiji = await tryZuiji(db, tid, eid, yyyyMm, ctx);
  if (zuiji) return zuiji;

  const teiji = await tryTeiji(db, tid, eid, yyyyMm, ctx);
  if (teiji) return teiji;

  const initial = await tryInitial(db, tid, eid, yyyyMm, ctx);
  if (initial) return initial;

  const carried = await carryForwardPrevious(db, tid, eid, yyyyMm, ctx);
  if (carried) return carried;

  throw new Error(
    `${yyyyMm} の標準報酬を決定できません。月次給与または過去の標準報酬履歴を確認してください。`,
  );
}

async function tryZuiji(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload | null> {
  const monthKeys = [
    addMonths(yyyyMm, -3),
    addMonths(yyyyMm, -2),
    addMonths(yyyyMm, -1),
    yyyyMm,
  ];
  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length !== 4) return null;

  const previousPayroll = sources[0].payroll.fixedWage ?? sources[0].payroll.basicSalary;
  const currentPayroll = sources[1].payroll.fixedWage ?? sources[1].payroll.basicSalary;
  if (previousPayroll === currentPayroll) return null;

  const previous = await getPreviousGrades(db, tid, eid, addMonths(yyyyMm, -3));
  if (!previous) return null;

  const outcome = determineStandardZuiji(ctx.employmentType, sources.slice(1), previous);
  if (outcome.kind !== 'applicable') return null;

  return gradesToPayload('zuiji', addMonths(yyyyMm, 1), outcome.grades);
}

async function tryTeiji(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload | null> {
  const { year, month } = parseYyyyMm(yyyyMm);
  if (month !== 7) return null;

  const licenseStartAt = ctx.employee.employeeEmployInfo?.licenseStartAt;
  if (!licenseStartAt) return null;
  const licenseDate = toFormDate(licenseStartAt);
  if (!licenseDate) return null;
  if (licenseDate.getFullYear() === year && licenseDate.getMonth() === 6) return null;

  const history = await listStandardRemuneration(db, tid, eid);
  const prior = history.find((item) => item.yyyyMm === yyyyMm);
  if (prior && prior.doc.source === 'zuiji') return null;

  const monthKeys = [`${year}-04`, `${year}-05`, `${year}-06`];
  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length === 0) return null;

  const outcome = determineTeiji(
    ctx.employmentType,
    sources.map((s) => toMonthPaymentBaseInput(s)),
  );
  if (outcome.kind !== 'calculated') return null;

  return gradesToPayload('teiji', `${year}-09`, outcome.grades);
}

async function tryInitial(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload | null> {
  const history = await listStandardRemuneration(db, tid, eid);
  if (history.some((item) => item.yyyyMm < yyyyMm)) return null;

  const outcome = determineInitial(ctx.monthly.payrollData);
  if (outcome.kind !== 'calculated') return null;

  return gradesToPayload('initial', yyyyMm, outcome.grades);
}

async function carryForwardPrevious(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload | null> {
  const history = await listStandardRemuneration(db, tid, eid);
  const prior = history.find((item) => item.yyyyMm < yyyyMm);

  if (!prior) {
    const outcome = determineInitial(ctx.monthly.payrollData);
    if (outcome.kind !== 'calculated') return null;
    return gradesToPayload('initial', yyyyMm, outcome.grades);
  }

  return {
    healthGrade: prior.doc.healthGrade,
    pensionGrade: prior.doc.pensionGrade,
    standardRemuneration: prior.doc.standardRemuneration,
    source: 'carried',
    effectiveFrom: prior.doc.effectiveFrom,
    remuneration: prior.doc.remuneration,
  };
}

function gradesToPayload(
  source: StandardRemunerationSource,
  effectiveFrom: string,
  grades: ResolvedStandardRemuneration,
): StandardRemunerationSavePayload {
  return {
    healthGrade: grades.health.grade,
    pensionGrade: grades.pension.grade,
    standardRemuneration: {
      health: grades.health.standardRemuneration,
      pension: grades.pension.standardRemuneration,
    },
    source,
    effectiveFrom,
    remuneration: grades.remuneration,
  };
}

function toSavePayload(doc: StandardRemunerationSavePayload): StandardRemunerationSavePayload {
  return { ...doc };
}

async function getPreviousGrades(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  beforeYyyyMm: string,
): Promise<PreviousGrades | null> {
  const history = await listStandardRemuneration(db, tid, eid);
  const prior = history.find((item) => item.yyyyMm <= beforeYyyyMm);
  if (!prior) return null;
  return {
    healthGrade: prior.doc.healthGrade,
    pensionGrade: prior.doc.pensionGrade,
  };
}

async function loadMonthSources(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  monthKeys: readonly string[],
): Promise<MonthlyRemunerationSource[]> {
  const sources: MonthlyRemunerationSource[] = [];
  for (const ym of monthKeys) {
    const monthly = await getMonthlyDocument(db, tid, eid, ym);
    if (!monthly?.payrollData) continue;
    sources.push({
      yyyyMm: ym,
      hasMonthlyRecord: true,
      daysInMonth: daysInMonth(ym),
      payroll: monthly.payrollData,
    });
  }
  return sources;
}
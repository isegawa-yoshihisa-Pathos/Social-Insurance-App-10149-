import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { calculateMonthlyPremium } from '../../../shared/social-insurance/premium/premium-calculator';
import { employeeLeaveRecordsToPeriodInputs } from '../../../shared/social-insurance/premium/leave-premium-exemption';
import {
  buildLeaveReturnRemunerationDedupeKey,
  buildLeaveReturnRemunerationNotificationBody,
  determineLeaveReturnRemuneration,
  findLeaveReturnScreeningTargets,
  leaveTypeLabel,
} from '../../../shared/social-insurance/remuneration/leave-return-remuneration-determination';
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
  assertMonthlyPeriodNotLocked,
  getEmployee,
  getLatestStandardRemuneration,
  getMonthlyDocument,
  getMonthlyPeriod,
  updateMonthlyBonusRelatedRemuneration,
  getStandardRemuneration,
  listStandardRemuneration,
  saveStandardRemuneration,
  resolveInsuranceRateForMonth,
  type StandardRemunerationSavePayload,
  type StandardRemunerationSource,
  type StandardRemunerationListItem,
  getBonusTypeDefinitions,
  listBonusRecordsInRange,
} from './repos';
import { screenAnnualAverageCandidate, type AnnualAverageMonthInput, buildAnnualAveragePeriodMonthKeys } from '../../../shared/social-insurance/remuneration/annual-average-determination';
import type { TeijiDeterminationOutcome } from '../../../shared/social-insurance/remuneration/teiji-determination';
import { screenZuijiAnnualAverageCandidate, buildZuijiAnnualAverageLoadKeys } from '../../../shared/social-insurance/remuneration/annual-average-determination';
import { teijiBonusLookbackRange, calculateBonusRemunerationAddition, buildTeijiApplicationMonthKeys } from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import {
  addYyyyMm,
  buildMayJuneZuijiPendingNotificationBody,
  formatZuijiEffectiveMonthLabel,
  getMayJuneZuijiSchedule,
  isMayOrJuneRaiseMonth,
  screenMayJuneZuijiFromSingleMonth,
} from '../../../shared/social-insurance/remuneration/may-june-zuiji';

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
  await assertMonthlyPeriodNotLocked(db, tid, yyyyMm);
  const ctx = await loadContext(db, tid, eid, yyyyMm);

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
    licenceStartAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseStartAt),
    resignAt: toFormDate(ctx.employee.employeeEmployInfo?.resignAt),
    leaveRecords: employeeLeaveRecordsToPeriodInputs(ctx.employee.leaveInfo),
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

  await tryLeaveReturnRemunerationScreening(db, tid, eid, yyyyMm, ctx);
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
  const mayJuneApplied = await tryApplyMayJuneZuijiAtEffectiveMonth(
    db,
    tid,
    eid,
    yyyyMm,
    ctx,
  );
  if (mayJuneApplied) return mayJuneApplied;

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
  const changeMonthYyyyMm = sources[1].yyyyMm; // 昇給（降給）月 M
  const previous = await getPreviousGrades(db, tid, eid, addMonths(yyyyMm, -3));
  if (!previous) return null;

  if (isMayOrJuneRaiseMonth(changeMonthYyyyMm)) {
    const schedule = getMayJuneZuijiSchedule(changeMonthYyyyMm);
    if (yyyyMm === schedule.screeningYyyyMm) {
      const screening = screenMayJuneZuijiFromSingleMonth(
        ctx.employmentType,
        sources[1],
        previous,
      );
      if (screening.kind === 'candidate') {
        await notifyMayJuneZuijiPending(
          db,
          tid,
          eid,
          yyyyMm,
          ctx,
          changeMonthYyyyMm,
          schedule.effectiveYyyyMm,
        );
      }
    }
    return null;
  }

  const outcome = determineStandardZuiji(ctx.employmentType, sources.slice(1), previous);
  if (outcome.kind !== 'applicable') return null;
  await notifyZuijiAnnualAverageIfNeeded(
    db,
    tid,
    eid,
    yyyyMm,
    ctx,
    previous,
    outcome.grades,
    changeMonthYyyyMm,
  );
  return gradesToPayload('zuiji', addMonths(yyyyMm, 1), outcome.grades);
}

async function tryApplyMayJuneZuijiAtEffectiveMonth(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardRemunerationSavePayload | null> {
  const { year } = parseYyyyMm(yyyyMm);
  for (const raiseMonth of [5, 6] as const) {
    const raiseMonthYyyyMm = `${year}-${String(raiseMonth).padStart(2, '0')}`;
    const schedule = getMayJuneZuijiSchedule(raiseMonthYyyyMm);
    if (yyyyMm !== schedule.effectiveYyyyMm) continue;

    const priorMonthKey = addYyyyMm(raiseMonthYyyyMm, -1);
    const zuijiMonthKeys = [
      raiseMonthYyyyMm,
      addYyyyMm(raiseMonthYyyyMm, 1),
      addYyyyMm(raiseMonthYyyyMm, 2),
    ];
    const [priorSources, zuijiSources] = await Promise.all([
      loadMonthSources(db, tid, eid, [priorMonthKey]),
      loadMonthSources(db, tid, eid, zuijiMonthKeys),
    ]);
    if (priorSources.length !== 1 || zuijiSources.length !== 3) continue;

    const priorPayroll =
      priorSources[0].payroll.fixedWage ?? priorSources[0].payroll.basicSalary;
    const raisePayroll =
      zuijiSources[0].payroll.fixedWage ?? zuijiSources[0].payroll.basicSalary;
    if (priorPayroll === raisePayroll) continue;

    const previous = await getPreviousGrades(db, tid, eid, priorMonthKey);
    if (!previous) continue;

    const outcome = determineStandardZuiji(ctx.employmentType, zuijiSources, previous);
    if (outcome.kind !== 'applicable') continue;

    await notifyZuijiAnnualAverageIfNeeded(
      db,
      tid,
      eid,
      yyyyMm,
      ctx,
      previous,
      outcome.grades,
      raiseMonthYyyyMm,
    );
    return gradesToPayload('zuiji', schedule.effectiveYyyyMm, outcome.grades);
  }
  return null;
}

async function notifyMayJuneZuijiPending(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
  raiseMonthYyyyMm: string,
  effectiveYyyyMm: string,
): Promise<void> {
  try {
    const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
    const effectiveLabel = formatZuijiEffectiveMonthLabel(effectiveYyyyMm);
    const body = buildMayJuneZuijiPendingNotificationBody(
      employeeName,
      raiseMonthYyyyMm,
      effectiveYyyyMm,
    );
    const now = admin.firestore.FieldValue.serverTimestamp();
    const notifDoc = {
      scope: 'tenant' as const,
      type: 'mayJuneZuijiPending',
      title: `【随時改定の見込み】${employeeName}様（${effectiveLabel}適用予定）`,
      body,
      targetEid: eid,
      raiseMonthYyyyMm,
      effectiveYyyyMm,
      screeningYyyyMm: yyyyMm,
      status: 'pending_review',
      read: false,
      tid,
      createdAt: now,
    };

    const admins = await db
      .collection('tenants')
      .doc(tid)
      .collection('employees')
      .where('role', '==', 'admin')
      .get();

    for (const adminDoc of admins.docs) {
      const uid = adminDoc.data()?.uid as string | undefined;
      if (!uid) continue;
      await db.collection('accounts').doc(uid).collection('notifications').add(notifDoc);
    }

    if (ctx.employee.uid) {
      await db.collection('accounts').doc(ctx.employee.uid).collection('notifications').add({
        scope: 'personal',
        type: 'may_june_zuiji_pending',
        title: `【社会保険】${effectiveLabel}から随時改定の可能性があります`,
        body,
        targetEid: eid,
        raiseMonthYyyyMm,
        effectiveYyyyMm,
        status: 'assigned',
        read: false,
        createdAt: now,
      });
    }
  } catch (err) {
    console.error('[may-june-zuiji] notification failed', { tid, eid, yyyyMm, err });
  }
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

  const history = await listStandardRemuneration(db, tid, eid);
  const exactPrior = history.find((item) => item.yyyyMm === yyyyMm);
  if (exactPrior && exactPrior.doc.source === 'zuiji') return null;

  const prior = history.find((item) => item.yyyyMm < yyyyMm);

  const licenseStartAt = ctx.employee.employeeEmployInfo?.licenseStartAt;
  if (!licenseStartAt) return null;
  const licenseDate = toFormDate(licenseStartAt);
  if (!licenseDate) return null;
  if (licenseDate.getFullYear() === year && licenseDate.getMonth() === 6) return null;

  const monthKeys = [`${year}-04`, `${year}-05`, `${year}-06`];
  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length === 0) return null;

  const {from, to} = teijiBonusLookbackRange(year);
  const bonusRecords = await listBonusRecordsInRange(db, tid, eid, from, to);
  const bonusDefs = await getBonusTypeDefinitions(db, tid);

  const addition = calculateBonusRemunerationAddition(bonusRecords, bonusDefs);
  const monthInputs = sources.map((s) => toMonthPaymentBaseInput(s));

  const outcome = determineTeiji(
    ctx.employmentType,
    monthInputs,
  );
  if (outcome.kind !== 'invalid') {
    await notifyAnnualAverageIfNeeded(db, tid, eid, yyyyMm, year, ctx, outcome, prior ?? null);
  }
  if (outcome.kind === 'invalid') return null;

  await applyTeijiBonusRelatedRemunerationToMonthlyRecords(
    db,
    tid,
    eid,
    year,
    addition,
  );

  if (outcome.kind === 'continue_previous') {
    if (!prior) {
      const initialOutcome = determineInitial(
        ctx.monthly.payrollData,
        ctx.monthly.bonusRelatedRemuneration ?? 0,
      );
      if (initialOutcome.kind !== 'calculated') return null;
      return gradesToPayload('initial', yyyyMm, initialOutcome.grades);
    }

    return {
      healthGrade: prior.doc.healthGrade,
      pensionGrade: prior.doc.pensionGrade,
      standardRemuneration: prior.doc.standardRemuneration,
      source: 'teiji',
      effectiveFrom: `${year}-09`,
      remuneration: prior.doc.remuneration,
      bonusRemunerationMonthlyAddition: addition > 0 ? addition : undefined,
    };
  }

  return {
    ...gradesToPayload('teiji', `${year}-09`, outcome.grades),
    bonusRemunerationMonthlyAddition: addition > 0 ? addition : undefined,
  };
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

  const outcome = determineInitial(
    ctx.monthly.payrollData,
    ctx.monthly.bonusRelatedRemuneration ?? 0,
  );
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
    const outcome = determineInitial(
      ctx.monthly.payrollData,
      ctx.monthly.bonusRelatedRemuneration ?? 0,
    );
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
      paymentBaseDays: monthly.paymentBaseDays,
      bonusRelatedRemuneration: monthly.bonusRelatedRemuneration ?? 0,
    });
  }
  return sources;
}

function teijiGradesFromOutcome(
  outcome: TeijiDeterminationOutcome,
  prior: StandardRemunerationListItem | null,
): { teijiHealthGrade: number; teijiPensionGrade: number } | null {
  if (outcome.kind === 'calculated') {
    return {
      teijiHealthGrade: outcome.grades.health.grade,
      teijiPensionGrade: outcome.grades.pension.grade,
    };
  }
  if (outcome.kind === 'continue_previous') {
    if (!prior) return null;
    return {
      teijiHealthGrade: prior.doc.healthGrade,
      teijiPensionGrade: prior.doc.pensionGrade,
    };
  }
  return null;
}

function toAnnualAverageMonthInputs(
  sources: MonthlyRemunerationSource[],
): AnnualAverageMonthInput[] {
  return sources.map((s) => ({
    yyyyMm: s.yyyyMm,
    paymentBaseDays: s.paymentBaseDays,
    payroll: s.payroll,
    bonusRelatedRemuneration: s.bonusRelatedRemuneration,
  }));
}

async function applyTeijiBonusRelatedRemunerationToMonthlyRecords(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  addition: number,
): Promise<void> {
  const monthKeys = buildTeijiApplicationMonthKeys(teijiYear);
  await Promise.all(
    monthKeys.map(async (ym) => {
      const period = await getMonthlyPeriod(db, tid, ym);
      if (period?.locked) return;

      const monthly = await getMonthlyDocument(db, tid, eid, ym);
      if (!monthly) return;

      await updateMonthlyBonusRelatedRemuneration(db, tid, eid, ym, addition);
    }),
  );
}

async function notifyAnnualAverageIfNeeded(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  year: number,
  ctx: CalculationContext,
  teijiOutcome: TeijiDeterminationOutcome,
  prior: StandardRemunerationListItem | null,
): Promise<void> {
  try {
    const teijiGrades = teijiGradesFromOutcome(teijiOutcome, prior);
    if (!teijiGrades) return;

    const periodKeys = buildAnnualAveragePeriodMonthKeys(yyyyMm);
    const annualSources = await loadMonthSources(db, tid, eid, periodKeys);
    const screening = screenAnnualAverageCandidate(
      ctx.employmentType,
      teijiGrades,
      toAnnualAverageMonthInputs(annualSources),
    );

    if (screening.kind !== 'candidate') return;

    const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
    const teijiTypeStr =
      teijiOutcome.kind === 'continue_previous'
        ? '4〜6月の支払基礎日数不足による「従前等級の据え置き」'
        : '4〜6月の「通常算定による試算」';

    const now = admin.firestore.FieldValue.serverTimestamp();
    const notifDoc = {
      scope: 'tenant' as const,
      type: 'annualAverageSuggestion',
      title: `【年間平均算定の推奨】${employeeName}様 が対象候補です`,
      body: `${employeeName}様において、${teijiTypeStr}の等級と、` +
  `前年7月〜当年6月の${screening.annualAverage.divisor}ヶ月平均` +
  `（報酬総額 ${screening.annualAverage.totalRemuneration.toLocaleString()}円 ÷ ${screening.annualAverage.divisor}）` +
  `による等級との間に、年間平均採択基準を満たす等級差` +
  `（健康保険: ${screening.healthDiff}等級差 / 厚生年金: ${screening.pensionDiff}等級差）` +
  `が検出されました。本人の同意のもと、年間平均での申告を推奨します。`,
      targetEid: eid,
      targetYear: year,
      status: 'pending_review',
      read: false,
      tid,
      createdAt: now,
    };

    const admins = await db
      .collection('tenants')
      .doc(tid)
      .collection('employees')
      .where('role', '==', 'admin')
      .get();

    for (const adminDoc of admins.docs) {
      const uid = adminDoc.data()?.uid as string | undefined;
      if (!uid) continue;
      await db.collection('accounts').doc(uid).collection('notifications').add(notifDoc);
    }

    if (ctx.employee.uid) {
      await db.collection('accounts').doc(ctx.employee.uid).collection('notifications').add({
        scope: 'personal',
        type: 'annual_average_consent',
        title: '【社会保険】定時決定における年間平均適用の同意確認',
        body: '4〜6月の勤務日数不足、または季節的な給与変動に基づき、通常の定時決定ではなく直近1年間の給与平均（年間平均算定）を適用する候補となっています。保険料の変動内容を確認し、回答を行ってください。',
        targetEid: eid,
        targetYear: year,
        status: 'assigned',
        read: false,
        createdAt: now,
      });
    }
  } catch (err) {
    console.error('[annual-average] notification failed', { tid, eid, yyyyMm, err });
  }
}

async function tryLeaveReturnRemunerationScreening(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<void> {
  try {
    const leaveRecords = employeeLeaveRecordsToPeriodInputs(ctx.employee.leaveInfo);
    const targets = findLeaveReturnScreeningTargets(yyyyMm, leaveRecords);
    if (targets.length === 0) return;

    for (const target of targets) {
      const sources = await loadMonthSources(db, tid, eid, target.measurementMonthKeys);
      if (sources.length !== target.measurementMonthKeys.length) continue;

      const previous = await getPreviousGrades(db, tid, eid, yyyyMm);
      if (!previous) continue;

      const outcome = determineLeaveReturnRemuneration(
        ctx.employmentType,
        sources,
        previous,
      );
      if (outcome.kind !== 'applicable') continue;

      const dedupeKey = buildLeaveReturnRemunerationDedupeKey(eid, target.leaveEndYyyyMm);
      const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
      const body = buildLeaveReturnRemunerationNotificationBody({
        employeeName,
        leaveType: target.leaveType,
        leaveEndYyyyMm: target.leaveEndYyyyMm,
        effectiveYyyyMm: target.effectiveYyyyMm,
        currentGrades: previous,
        proposedGrades: outcome.grades,
        averageRemuneration: outcome.average.averageRemuneration,
        healthDiff: outcome.healthDiff,
        pensionDiff: outcome.pensionDiff,
        employmentType: ctx.employmentType,
      });
      const now = admin.firestore.FieldValue.serverTimestamp();
      const notifDoc = {
        scope: 'tenant' as const,
        type: 'leaveReturnRemunerationSuggestion',
        title: `【休業明け標準報酬月額調整】${employeeName}様（${leaveTypeLabel(target.leaveType)}）`,
        body,
        targetEid: eid,
        leaveType: target.leaveType,
        leaveEndYyyyMm: target.leaveEndYyyyMm,
        returnStartYyyyMm: target.returnStartYyyyMm,
        effectiveYyyyMm: target.effectiveYyyyMm,
        screeningYyyyMm: target.screeningYyyyMm,
        proposedHealthGrade: outcome.grades.health.grade,
        proposedPensionGrade: outcome.grades.pension.grade,
        dedupeKey,
        status: 'pending_review',
        read: false,
        tid,
        createdAt: now,
      };

      const admins = await db
        .collection('tenants')
        .doc(tid)
        .collection('employees')
        .where('role', '==', 'admin')
        .get();

      for (const adminDoc of admins.docs) {
        const uid = adminDoc.data()?.uid as string | undefined;
        if (!uid) continue;
        if (await hasNotificationWithDedupeKey(db, uid, dedupeKey)) continue;
        await db.collection('accounts').doc(uid).collection('notifications').add(notifDoc);
      }

      if (ctx.employee.uid) {
        const personalDedupeKey = `${dedupeKey}_personal`;
        if (!(await hasNotificationWithDedupeKey(db, ctx.employee.uid, personalDedupeKey))) {
          await db.collection('accounts').doc(ctx.employee.uid).collection('notifications').add({
            scope: 'personal',
            type: 'leave_return_remuneration_consent',
            title: '【社会保険】休業明けの標準報酬月額調整の同意確認',
            body,
            targetEid: eid,
            leaveType: target.leaveType,
            leaveEndYyyyMm: target.leaveEndYyyyMm,
            effectiveYyyyMm: target.effectiveYyyyMm,
            dedupeKey: personalDedupeKey,
            status: 'assigned',
            read: false,
            createdAt: now,
          });
        }
      }
    }
  } catch (err) {
    console.error('[leave-return-remuneration] screening failed', { tid, eid, yyyyMm, err });
  }
}

async function hasNotificationWithDedupeKey(
  db: admin.firestore.Firestore,
  uid: string,
  dedupeKey: string,
): Promise<boolean> {
  const snap = await db
    .collection('accounts')
    .doc(uid)
    .collection('notifications')
    .where('dedupeKey', '==', dedupeKey)
    .limit(1)
    .get();
  return !snap.empty;
}

async function notifyZuijiAnnualAverageIfNeeded(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
  currentGrades: PreviousGrades,
  normalZuijiGrades: ResolvedStandardRemuneration,
  changeMonthYyyyMm: string,
): Promise<void> {
  try {
    const loadKeys = buildZuijiAnnualAverageLoadKeys(changeMonthYyyyMm);
    const annualSources = await loadMonthSources(db, tid, eid, loadKeys);
    const screening = screenZuijiAnnualAverageCandidate(
      ctx.employmentType,
      currentGrades,
      normalZuijiGrades,
      changeMonthYyyyMm,
      toAnnualAverageMonthInputs(annualSources),
    );
    if (screening.kind !== 'candidate') return;
    const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
    const { annualAverage, diffs } = screening;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const notifDoc = {
      scope: 'tenant' as const,
      type: 'zuijiAnnualAverageSuggestion',
      title: `【随時改定・年間平均算定の推奨】${employeeName}様`,
      body:
        `${employeeName}様において、通常の随時改定（${normalZuijiGrades.health.grade}/${normalZuijiGrades.pension.grade}等級）` +
        `と年間平均試算（${annualAverage.grades.health.grade}/${annualAverage.grades.pension.grade}等級）` +
        `の双方が現在の等級（${currentGrades.healthGrade}/${currentGrades.pensionGrade}等級）` +
        `と所定の等級差基準を満たしました。` +
        `年間平均報酬月額: ${Math.round(annualAverage.averageRemuneration).toLocaleString()}円` +
        `（固定平均 ${Math.round(annualAverage.fixedAfterAverage.average).toLocaleString()}円 + ` +
        `非固定平均 ${Math.round(annualAverage.variableWindowAverage.average).toLocaleString()}円）。` +
        `差: 現在↔通常 ${diffs.currentVsNormal.health}/${diffs.currentVsNormal.pension}、` +
        `通常↔年間平均 ${diffs.normalVsAnnual.health}/${diffs.normalVsAnnual.pension}、` +
        `現在↔年間平均 ${diffs.currentVsAnnual.health}/${diffs.currentVsAnnual.pension}（健保/厚年）。` +
        `本人同意のうえ年間平均での届出を検討してください。`,
      targetEid: eid,
      changeMonthYyyyMm,
      status: 'pending_review',
      read: false,
      tid,
      createdAt: now,
    };
    const admins = await db
      .collection('tenants')
      .doc(tid)
      .collection('employees')
      .where('role', '==', 'admin')
      .get();
    for (const adminDoc of admins.docs) {
      const uid = adminDoc.data()?.uid as string | undefined;
      if (!uid) continue;
      await db.collection('accounts').doc(uid).collection('notifications').add(notifDoc);
    }
    if (ctx.employee.uid) {
      await db.collection('accounts').doc(ctx.employee.uid).collection('notifications').add({
        scope: 'personal',
        type: 'zuiji_annual_average_consent',
        title: '【社会保険】随時改定における年間平均適用の同意確認',
        body: '固定的賃金の変動に伴い通常の随時改定が該当しますが、年間平均算定の適用候補でもあります。内容を確認のうえ回答してください。',
        targetEid: eid,
        changeMonthYyyyMm,
        status: 'assigned',
        read: false,
        createdAt: now,
      });
    }
  } catch (err) {
    console.error('[zuiji-annual-average] notification failed', { tid, eid, yyyyMm, err });
  }
}
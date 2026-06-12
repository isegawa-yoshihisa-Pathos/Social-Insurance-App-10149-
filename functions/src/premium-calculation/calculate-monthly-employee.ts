import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { calculateMonthlyPremium } from '../../../shared/social-insurance/premium/premium-calculator';
import { employeeLeaveRecordsToPeriodInputs } from '../../../shared/social-insurance/premium/leave-premium-exemption';
import {
  determineLeaveReturnRemuneration,
  findLeaveReturnScreeningTargets,
} from '../../../shared/social-insurance/remuneration/leave-return-remuneration-determination';
import { determineInitial } from '../../../shared/social-insurance/remuneration/initial-determination';
import { determineTeiji } from '../../../shared/social-insurance/remuneration/teiji-determination';
import { determineStandardZuiji } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { PreviousGrades } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import { computeFixedWageFromPayroll } from '../../../shared/social-insurance/remuneration/fixed-wage';
import type { MonthlyRemunerationSource } from '../../../shared/social-insurance/remuneration/remuneration-month-input';
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
  updateMonthlyBonusRelatedRemuneration,
  getStandardRemuneration,
  listStandardRemuneration,
  saveStandardRemuneration,
  resolveInsuranceRateForMonth,
  type StandardRemunerationSavePayload,
  type StandardRemunerationSource,
  type StandardRemunerationListItem,
  getTenant,
  isConfirmedStandardRemunerationSource,
} from './repos';
import type { TeijiDeterminationOutcome } from '../../../shared/social-insurance/remuneration/teiji-determination';
import { isTeijiReplacementZuijiEffectiveMonth, teijiYearFromEffectiveMonth, isBonusRelatedRemunerationUnset, withBonusRelatedRemuneration } from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import {
  computeTeijiBonusRelatedRemuneration,
  applyTeijiBonusRelatedRemunerationToMonthlyRecords,
} from './teiji-bonus-remuneration';
import {
  buildMayJuneZuijiPendingNotificationBody,
  formatZuijiEffectiveMonthLabel,
  getMayJuneZuijiSchedule,
  isMayOrJuneRaiseMonth,
  screenMayJuneZuijiFromSingleMonth,
} from '../../../shared/social-insurance/remuneration/may-june-zuiji';
import {
  ensureMayJuneZuijiReviewPending,
  hasTeijiReplacementZuijiForYear,
  tryFinalizeApprovedMayJuneZuiji,
} from './may-june-zuiji-review';
import {
  ensureTeijiAnnualAverageConsentReview,
  ensureZuijiAnnualAverageConsentReview,
  ensureLeaveReturnConsentReview,
} from './remuneration-consent-review';

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
  const [ctx, tenant] = await Promise.all([
    loadContext(db, tid, eid, yyyyMm),
    getTenant(db, tid),
  ]);
  await ensureBonusRelatedRemunerationCarriedForward(db, tid, eid, yyyyMm, ctx);
  const personalInfo = ctx.employee.employeePersonalInfo;
  const careInsuranceCollection = {
    specificInsuranceCollectionType:
      tenant?.socialInsuranceSettings?.specificInsuranceCollectionType,
    hasDependents: personalInfo?.hasDependents,
    dependentsInfo: personalInfo?.dependentsInfo,
  };

  const rawStandardRemuneration = await resolveStandardRemuneration(db, tid, eid, yyyyMm, ctx);

  if (rawStandardRemuneration.source !== 'carried' && rawStandardRemuneration.source !== 'provisional_zuiji') {
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
    ...careInsuranceCollection,
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
  const finalized = await tryFinalizeApprovedMayJuneZuiji(
    db,
    tid,
    eid,
    yyyyMm,
    ctx.employmentType,
  );
  if (finalized) {
    await notifyZuijiAnnualAverageIfNeeded(
      db,
      tid,
      eid,
      yyyyMm,
      ctx,
      finalized.previous,
      finalized.grades,
      finalized.raiseMonthYyyyMm,
    );
    return finalized.payload;
  }

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
        {
          fixedWageBeforeChange: computeFixedWageFromPayroll(sources[0].payroll),
        },
      );
      if (screening.kind === 'candidate') {
        const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '未登録';
        const { created } = await ensureMayJuneZuijiReviewPending(
          db,
          tid,
          eid,
          changeMonthYyyyMm,
          employeeName,
        );
        if (created) {
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
    }
    return null;
  }

  const effectiveFrom = addMonths(yyyyMm, 1);
  let zuijiMonths = sources.slice(1);
  let teijiPeriodBonusAddition: number | undefined;
  let teijiPeriodBonusQualifies = false;

  if (isTeijiReplacementZuijiEffectiveMonth(effectiveFrom)) {
    const teijiYear = teijiYearFromEffectiveMonth(effectiveFrom);
    const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
    teijiPeriodBonusQualifies = teijiBonus.qualifies;
    if (teijiBonus.qualifies) {
      teijiPeriodBonusAddition = teijiBonus.addition;
      zuijiMonths = withBonusRelatedRemuneration(zuijiMonths, teijiBonus.addition);
    }
  }

  const outcome = determineStandardZuiji(ctx.employmentType, zuijiMonths, previous, {
    fixedWageBeforeChange: computeFixedWageFromPayroll(sources[0].payroll),
  });
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

  if (teijiPeriodBonusQualifies && teijiPeriodBonusAddition != null) {
    await applyTeijiBonusRelatedRemunerationToMonthlyRecords(
      db,
      tid,
      eid,
      teijiYearFromEffectiveMonth(effectiveFrom),
      teijiPeriodBonusAddition,
      effectiveFrom,
    );
  }

  return {
    ...gradesToPayload('zuiji', effectiveFrom, outcome.grades),
    bonusRemunerationMonthlyAddition:
      teijiPeriodBonusQualifies && teijiPeriodBonusAddition != null && teijiPeriodBonusAddition > 0
        ? teijiPeriodBonusAddition
        : undefined,
  };
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
      title: `【随時改定の確認依頼】${employeeName}様（${effectiveLabel}適用予定）`,
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
  const hasReplacementZuiji = await hasTeijiReplacementZuijiForYear(db, tid, eid, year);
  if (hasReplacementZuiji) return null;

  const prior = history.find((item) => item.yyyyMm < yyyyMm);

  const licenseStartAt = ctx.employee.employeeEmployInfo?.licenseStartAt;
  if (!licenseStartAt) return null;
  const licenseDate = toFormDate(licenseStartAt);
  if (!licenseDate) return null;
  if (licenseDate.getFullYear() === year && licenseDate.getMonth() === 6) return null;

  const monthKeys = [`${year}-04`, `${year}-05`, `${year}-06`];
  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length === 0) return null;

  const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, year);
  const teijiSources = teijiBonus.qualifies
    ? withBonusRelatedRemuneration(sources, teijiBonus.addition)
    : sources;

  const outcome = determineTeiji(ctx.employmentType, teijiSources);
  if (outcome.kind !== 'invalid') {
    await notifyAnnualAverageIfNeeded(db, tid, eid, yyyyMm, year, ctx, outcome, prior ?? null);
  }
  if (outcome.kind === 'invalid') return null;

  if (teijiBonus.qualifies) {
    await applyTeijiBonusRelatedRemunerationToMonthlyRecords(
      db,
      tid,
      eid,
      year,
      teijiBonus.addition,
    );
  }

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
      bonusRemunerationMonthlyAddition:
        teijiBonus.qualifies && teijiBonus.addition > 0 ? teijiBonus.addition : undefined,
    };
  }

  return {
    ...gradesToPayload('teiji', `${year}-09`, outcome.grades),
    bonusRemunerationMonthlyAddition:
      teijiBonus.qualifies && teijiBonus.addition > 0 ? teijiBonus.addition : undefined,
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
  const prior = history.find(
    (item) =>
      item.yyyyMm <= beforeYyyyMm &&
      isConfirmedStandardRemunerationSource(item.doc.source),
  );
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

async function ensureBonusRelatedRemunerationCarriedForward(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<void> {
  const previousMonthly = await getMonthlyDocument(db, tid, eid, addMonths(yyyyMm, -1));
  const previousValue = previousMonthly?.bonusRelatedRemuneration;
  if (previousValue == null || previousValue <= 0) return;

  const current = ctx.monthly.bonusRelatedRemuneration;
  const needsCarry =
    isBonusRelatedRemunerationUnset(current) || current === 0;
  if (!needsCarry) return;

  await updateMonthlyBonusRelatedRemuneration(db, tid, eid, yyyyMm, previousValue);
  ctx.monthly.bonusRelatedRemuneration = previousValue;
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

    await ensureTeijiAnnualAverageConsentReview(
      db,
      tid,
      eid,
      yyyyMm,
      year,
      ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員',
      ctx.employee.uid,
      ctx.employmentType,
      teijiGrades.teijiHealthGrade,
      teijiGrades.teijiPensionGrade,
    );
  } catch (err) {
    console.error('[annual-average] consent review failed', { tid, eid, yyyyMm, err });
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

      await ensureLeaveReturnConsentReview(
        db,
        tid,
        eid,
        ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員',
        ctx.employee.uid,
        ctx.employmentType,
        {
          leaveType: target.leaveType,
          leaveEndYyyyMm: target.leaveEndYyyyMm,
          returnStartYyyyMm: target.returnStartYyyyMm,
          screeningYyyyMm: target.screeningYyyyMm,
          effectiveYyyyMm: target.effectiveYyyyMm,
          measurementMonthKeys: target.measurementMonthKeys,
          previous,
          grades: outcome.grades,
          averageRemuneration: outcome.average.averageRemuneration,
          healthDiff: outcome.healthDiff,
          pensionDiff: outcome.pensionDiff,
        },
      );
    }
  } catch (err) {
    console.error('[leave-return-remuneration] screening failed', { tid, eid, yyyyMm, err });
  }
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
    await ensureZuijiAnnualAverageConsentReview(
      db,
      tid,
      eid,
      ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員',
      ctx.employee.uid,
      ctx.employmentType,
      currentGrades,
      normalZuijiGrades,
      changeMonthYyyyMm,
    );
  } catch (err) {
    console.error('[zuiji-annual-average] consent review failed', { tid, eid, yyyyMm, err });
  }
}
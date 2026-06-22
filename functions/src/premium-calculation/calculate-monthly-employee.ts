import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import { resolveEmploymentType, type EmployeeDocument } from '../../../shared/employee-document';
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
import {
  ensureTeijiRetroactiveReview,
  ensureTeijiAnnualAverageRetroactiveReview,
} from './retroactive-remuneration-review';
import {
  buildPremiumCalculationSkipMessage,
  isMissingRequiredFields,
  skipMonthlyPremiumCalculationIfResigned,
} from './premium-calculation-skip';
import {
  ensureStandardZuijiApplicableAlert,
  ensureTeijiNonTargetAlert,
} from './remuneration-admin-alert';
import { ensureMultiWorkplaceManualPremiumAlert } from './multi-workplace-premium-alert';
import { ensureAgePremiumTransitionAlerts } from './age-premium-alert';
import { ensureLeavePremiumExemptionAlerts } from './leave-premium-alert';
import type { MultiWorkplacePremiumAlertTrigger } from '../../../shared/social-insurance/multi-workplace/multi-workplace-alert-messages';

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
  const errorMessage = isMissingRequiredFields(ctx.employee);
  if (errorMessage) {
    throw new Error(`従業員${ctx.employee.employeePersonalInfo?.displayName}は${errorMessage}です。`);
  }
  if (await skipMonthlyPremiumCalculationIfResigned(db, tid, eid, yyyyMm, ctx.employee)) {
    throw new Error(buildPremiumCalculationSkipMessage(ctx.employee, yyyyMm));
  }
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
    await notifyMultiWorkplaceManualPremiumIfNeeded(
      db,
      tid,
      eid,
      ctx,
      yyyyMm,
      rawStandardRemuneration.source,
    );
  }

  const standardRemuneration =
    (await getLatestStandardRemuneration(db, tid, eid, yyyyMm)) ?? rawStandardRemuneration;

  const rate = await resolveInsuranceRateForMonth(db, tid, yyyyMm);
  if (!rate) {
    throw new Error('保険料率が見つかりません');
  }

  const leaveRecords = employeeLeaveRecordsToPeriodInputs(ctx.employee.leaveInfo);

  const premiumData = calculateMonthlyPremium({
    yyyyMm,
    birthDate: ctx.birthDate,
    licenceStartAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseStartAt),
    resignAt: toFormDate(ctx.employee.employeeEmployInfo?.resignAt),
    licenseEndAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseEndAt),
    leaveRecords,
    ...careInsuranceCollection,
    standardRemuneration: standardRemuneration.standardRemuneration,
    rates: rate.rates,
    employeeRate: rate.employeeRate,
    roundingBy: rate.roundingBy,
    roundingBoundaryType: rate.roundingBoundaryType,
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
    roundingBoundaryType: rate.roundingBoundaryType,
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

  await ensureAgePremiumTransitionAlerts(db, tid, eid, ctx.employee, {
    premiumKind: 'monthly',
    yyyyMm,
    birthDate: ctx.birthDate,
    licenceStartAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseStartAt),
    resignAt: toFormDate(ctx.employee.employeeEmployInfo?.resignAt),
    licenseEndAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseEndAt),
    ...careInsuranceCollection,
  });

  await ensureLeavePremiumExemptionAlerts(db, tid, eid, ctx.employee, {
    yyyyMm,
    premiumKind: 'monthly',
    leaveRecords,
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
    employmentType: resolveEmploymentType(employee.employeeEmployInfo?.employmentType),
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

  await tryMayJuneRaiseMonthScreening(db, tid, eid, yyyyMm, ctx);

  const monthKeys = [
    addMonths(yyyyMm, -3),
    addMonths(yyyyMm, -2),
    addMonths(yyyyMm, -1),
    yyyyMm,
  ];
  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length !== 4) return null;
  const previousPayroll = sources[0].payroll.fixedWage ?? sources[0].payroll.basicSalary + sources[0].payroll.fringeBenefits;
  const currentPayroll = sources[1].payroll.fixedWage ?? sources[1].payroll.basicSalary + sources[1].payroll.fringeBenefits;
  if (previousPayroll === currentPayroll) return null;
  const changeMonthYyyyMm = sources[1].yyyyMm; // 昇給（降給）月 M
  const previous = await getPreviousGrades(db, tid, eid, addMonths(yyyyMm, -3));
  if (!previous) return null;

  if (isMayOrJuneRaiseMonth(changeMonthYyyyMm)) {
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

  const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
  await ensureStandardZuijiApplicableAlert(
    db,
    tid,
    eid,
    changeMonthYyyyMm,
    effectiveFrom,
    yyyyMm,
    employeeName,
    previous,
    outcome,
  );

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

/** 5・6月の月次計算時: 前月比で固定的賃金変動があれば単月判定し、管理者へ通知する */
async function tryMayJuneRaiseMonthScreening(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<void> {
  if (!isMayOrJuneRaiseMonth(yyyyMm)) return;

  const prevMonthKey = addMonths(yyyyMm, -1);
  const prevMonthly = await getMonthlyDocument(db, tid, eid, prevMonthKey);
  if (!prevMonthly?.payrollData) return;

  const prevPayroll =
    prevMonthly.payrollData.fixedWage ?? prevMonthly.payrollData.basicSalary + prevMonthly.payrollData.fringeBenefits;
  const currentPayroll =
    ctx.monthly.payrollData.fixedWage ?? ctx.monthly.payrollData.basicSalary + ctx.monthly.payrollData.fringeBenefits;
  if (prevPayroll === currentPayroll) return;

  const previous = await getPreviousGrades(db, tid, eid, prevMonthKey);
  if (!previous) return;

  const raiseMonthSource: MonthlyRemunerationSource = {
    yyyyMm,
    hasMonthlyRecord: true,
    daysInMonth: daysInMonth(yyyyMm),
    payroll: ctx.monthly.payrollData,
    paymentBaseDays: ctx.monthly.paymentBaseDays,
    bonusRelatedRemuneration: ctx.monthly.bonusRelatedRemuneration ?? 0,
  };

  const screening = screenMayJuneZuijiFromSingleMonth(
    ctx.employmentType,
    raiseMonthSource,
    previous,
    {
      fixedWageBeforeChange: computeFixedWageFromPayroll(prevMonthly.payrollData),
    },
  );
  if (screening.kind !== 'candidate') return;

  const schedule = getMayJuneZuijiSchedule(yyyyMm);
  const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '未登録';
  await ensureMayJuneZuijiReviewPending(
    db,
    tid,
    eid,
    yyyyMm,
    employeeName,
  );
  await notifyMayJuneZuijiPending(
    db,
    tid,
    eid,
    yyyyMm,
    ctx,
    yyyyMm,
    schedule.effectiveYyyyMm,
  );
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
  // 6月計算時に定時決定（4〜6月平均）。7月初の算定基礎届提出に間に合わせる。
  if (month !== 6) return null;

  const history = await listStandardRemuneration(db, tid, eid);
  const hasReplacementZuiji = await hasTeijiReplacementZuijiForYear(db, tid, eid, year);
  if (hasReplacementZuiji) return null;

  const prior = history.find((item) => item.yyyyMm < yyyyMm);

  const licenseStartAt = ctx.employee.employeeEmployInfo?.licenseStartAt;
  if (!licenseStartAt) return null;
  const licenseDate = toFormDate(licenseStartAt);
  if (!licenseDate) return null;
  const employeeName = ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員';
  const monthKeys = [`${year}-04`, `${year}-05`, `${year}-06`] as const;
  if (licenseDate.getFullYear() === year && licenseDate.getMonth() >= 5) {
    await ensureTeijiNonTargetAlert(
      db,
      tid,
      eid,
      year,
      yyyyMm,
      employeeName,
      ctx.employee,
      'license_start_after_june',
      monthKeys,
    );
    return null;
  }

  const sources = await loadMonthSources(db, tid, eid, monthKeys);
  if (sources.length === 0) return null;

  const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, year);
  const teijiSources = teijiBonus.qualifies
    ? withBonusRelatedRemuneration(sources, teijiBonus.addition)
    : sources;

  const outcome = determineTeiji(ctx.employmentType, teijiSources);
  if (outcome.kind !== 'invalid') {
    await notifyAnnualAverageIfNeeded(db, tid, eid, yyyyMm, year, ctx, outcome, prior ?? null);
    await notifyTeijiRetroactiveIfNeeded(
      db,
      tid,
      eid,
      yyyyMm,
      year,
      ctx,
      outcome,
      prior ?? null,
    );
  }
  if (outcome.kind === 'invalid') {
    await ensureTeijiNonTargetAlert(
      db,
      tid,
      eid,
      year,
      yyyyMm,
      employeeName,
      ctx.employee,
      'grade_not_found',
      monthKeys,
    );
    return null;
  }

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
    await ensureTeijiNonTargetAlert(
      db,
      tid,
      eid,
      year,
      yyyyMm,
      employeeName,
      ctx.employee,
      'insufficient_payment_base_days',
      monthKeys,
    );

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

async function notifyTeijiRetroactiveIfNeeded(
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
    const effectiveFrom = `${year}-09`;
    let originalGrades: {
      healthGrade: number;
      pensionGrade: number;
      healthStandardRemuneration: number;
      pensionStandardRemuneration: number;
      remuneration: number;
      effectiveFrom: string;
    } | null = null;

    if (teijiOutcome.kind === 'calculated') {
      originalGrades = {
        healthGrade: teijiOutcome.grades.health.grade,
        pensionGrade: teijiOutcome.grades.pension.grade,
        healthStandardRemuneration: teijiOutcome.grades.health.standardRemuneration,
        pensionStandardRemuneration: teijiOutcome.grades.pension.standardRemuneration,
        remuneration: teijiOutcome.grades.remuneration,
        effectiveFrom,
      };
    } else if (teijiOutcome.kind === 'continue_previous' && prior) {
      originalGrades = {
        healthGrade: prior.doc.healthGrade,
        pensionGrade: prior.doc.pensionGrade,
        healthStandardRemuneration: prior.doc.standardRemuneration.health,
        pensionStandardRemuneration: prior.doc.standardRemuneration.pension,
        remuneration: prior.doc.remuneration ?? 0,
        effectiveFrom,
      };
    }

    if (!originalGrades) return;

    await ensureTeijiRetroactiveReview(
      db,
      tid,
      eid,
      year,
      yyyyMm,
      ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員',
      originalGrades,
    );
  } catch (err) {
    console.error('[retroactive] teiji review failed', { tid, eid, yyyyMm, err });
  }
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

    const consentResult = await ensureTeijiAnnualAverageConsentReview(
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

    if (consentResult.created && consentResult.annualGrades) {
      const grades = consentResult.annualGrades;
      await ensureTeijiAnnualAverageRetroactiveReview(
        db,
        tid,
        eid,
        year,
        yyyyMm,
        ctx.employee.employeePersonalInfo?.displayName ?? '対象従業員',
        teijiGrades.teijiHealthGrade,
        teijiGrades.teijiPensionGrade,
        {
          healthGrade: grades.health.grade,
          pensionGrade: grades.pension.grade,
          healthStandardRemuneration: grades.health.standardRemuneration,
          pensionStandardRemuneration: grades.pension.standardRemuneration,
          remuneration: grades.remuneration,
          effectiveFrom: `${year}-09`,
        },
      );
    }
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

function resolveMultiWorkplaceAlertTrigger(
  source: StandardRemunerationSource,
): MultiWorkplacePremiumAlertTrigger | null {
  if (source === 'teiji') {
    return 'teiji';
  }
  if (source === 'zuiji' || source === 'initial' || source === 'manual') {
    return 'remuneration_change';
  }
  return null;
}

async function notifyMultiWorkplaceManualPremiumIfNeeded(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  ctx: CalculationContext,
  yyyyMm: string,
  source: StandardRemunerationSource,
): Promise<void> {
  const trigger = resolveMultiWorkplaceAlertTrigger(source);
  if (!trigger) {
    return;
  }

  await ensureMultiWorkplaceManualPremiumAlert(db, tid, eid, ctx.employee, {
    trigger,
    yyyyMm,
    employeeDisplayName: ctx.employee.employeePersonalInfo?.displayName,
  });
}
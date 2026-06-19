import * as admin from 'firebase-admin';
import type { BonusDocument } from '../../../shared/bonus-document';
import { hasBonusData, sumBonusDataAmount } from '../../../shared/bonus-data.util';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { calculateBonusPremium } from '../../../shared/social-insurance/premium/premium-calculator';
import { employeeLeaveRecordsToPeriodInputs } from '../../../shared/social-insurance/premium/leave-premium-exemption';
import {
  determineStandardBonus,
  evaluateBonusPremiumEligibility,
} from '../../../shared/social-insurance/bonus/standard-bonus-determination';
import {
  fiscalYearStartYyyyMm,
  isYyyyMmInFiscalYear,
  lastDayOfYyyyMm,
} from '../../../shared/social-insurance/bonus/social-insurance-data.util';
import { toFormDate } from '../../../shared/date-utils';
import {
  getTeijiEligibleBonusTypes,
  teijiBonusLookbackRange,
  teijiYearFromEffectiveFrom,
} from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import {
  assertBonusPeriodNotLocked,
  getBonusDocument,
  getEmployee,
  getLatestStandardRemuneration,
  getMonthlyDocument,
  getStandardBonus,
  listBonusRecordsInRange,
  listStandardBonus,
  resolveInsuranceRateForBonus,
  saveStandardBonus,
  getBonusTypeDefinitions,
  omitUndefinedFields,
  getTenant,
  type StandardBonusDocument,
  type StandardBonusSavePayload,
} from './repos';
import { skipBonusPremiumCalculationIfResigned, isMissingRequiredFields } from './premium-calculation-skip';
import { ensureMultiWorkplaceManualPremiumAlert } from './multi-workplace-premium-alert';

interface CalculationContext {
  employee: EmployeeDocument;
  bonus: BonusDocument;
  birthDate: Date | null;
}

export async function calculateBonusEmployee(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<void> {
  await assertBonusPeriodNotLocked(db, tid, yyyyMm);
  const [ctx, tenant] = await Promise.all([
    loadContext(db, tid, eid, yyyyMm),
    getTenant(db, tid),
  ]);
  const errorMessage = isMissingRequiredFields(ctx.employee);
  if (errorMessage) {
    throw new Error(`従業員${ctx.employee.employeePersonalInfo?.displayName}は${errorMessage}です。`);
  }
  if (await skipBonusPremiumCalculationIfResigned(db, tid, eid, yyyyMm, ctx.employee)) {
    throw new Error(`従業員${ctx.employee.employeePersonalInfo?.displayName}は資格取得前または資格喪失後です。`);
  }
  const personalInfo = ctx.employee.employeePersonalInfo;
  const careInsuranceCollection = {
    specificInsuranceCollectionType:
      tenant?.socialInsuranceSettings?.specificInsuranceCollectionType,
    hasDependents: personalInfo?.hasDependents,
    dependentsInfo: personalInfo?.dependentsInfo,
  };
  const standardBonus = await resolveStandardBonus(db, tid, eid, yyyyMm, ctx);
  await saveStandardBonus(db, tid, eid, yyyyMm, standardBonus);

  const rate = await resolveInsuranceRateForBonus(db, tid, yyyyMm);
  if (!rate) {
    throw new Error('保険料率が見つかりません');
  }

  const premiumData = calculateBonusPremium({
    yyyyMm,
    birthDate: ctx.birthDate,
    licenceStartAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseStartAt),
    resignAt: toFormDate(ctx.employee.employeeEmployInfo?.resignAt),
    licenseEndAt: toFormDate(ctx.employee.employeeEmployInfo?.licenseEndAt),
    leaveRecords: employeeLeaveRecordsToPeriodInputs(ctx.employee.leaveInfo),
    ...careInsuranceCollection,
    standardBonus: standardBonus.standardBonus,
    rates: rate.rates,
    employeeRate: rate.employeeRate,
    roundingBy: rate.roundingBy,
    roundingBoundaryType: rate.roundingBoundaryType,
  });

  const calculationSnapshot = omitUndefinedFields({
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
    standardBonus: standardBonus.standardBonus,
    bonusAmount: standardBonus.bonusAmount,
    rawStandardBonus: standardBonus.rawStandardBonus,
    source: standardBonus.source,
    skipReason: standardBonus.skipReason,
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db
    .collection('tenants')
    .doc(tid)
    .collection('bonus-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid)
    .update(
      omitUndefinedFields({
        premiumData,
        calculationSnapshot,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    );

  await ensureMultiWorkplaceManualPremiumAlert(db, tid, eid, ctx.employee, {
    trigger: 'bonus',
    yyyyMm,
    employeeDisplayName: ctx.employee.employeePersonalInfo?.displayName,
  });
}

async function resolveStandardBonus(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  ctx: CalculationContext,
): Promise<StandardBonusSavePayload> {
  const existing = await getStandardBonus(db, tid, eid, yyyyMm);
  if (existing?.source === 'manual') return toSavePayload(existing);

  const bonusAmount = ctx.bonus.bonusData ? sumBonusDataAmount(ctx.bonus.bonusData) : 0;
  if (bonusAmount <= 0) {
    throw new Error(`${yyyyMm} の賞与支給額がありません。`);
  }

  const bonusDefs = await getBonusTypeDefinitions(db, tid);
  const teijiIncludedBonusTypes = await resolveTeijiIncludedBonusTypes(
    db,
    tid,
    eid,
    yyyyMm,
    bonusDefs,
  );
  const eligibility = evaluateBonusPremiumEligibility(ctx.bonus.bonusData!, bonusDefs, {
    teijiIncludedBonusTypes,
  });

  const fiscalYearHealthStandardSum = await sumFiscalYearHealthStandard(
    db,
    tid,
    eid,
    yyyyMm,
  );

  const determined = determineStandardBonus({
    bonusAmount,
    fiscalYearHealthStandardSum,
    eligibility,
  });

  return omitUndefinedFields({
    standardBonus: determined.standardBonus,
    source: 'calculated' as const,
    effectiveFrom: lastDayOfYyyyMm(yyyyMm),
    bonusAmount: determined.bonusAmount,
    rawStandardBonus: determined.rawStandardBonus,
    skipReason: eligibility.reason,
  });
}

async function resolveTeijiIncludedBonusTypes(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  bonusDefs: Awaited<ReturnType<typeof getBonusTypeDefinitions>>,
): Promise<ReadonlySet<string>> {
  const monthly = await getMonthlyDocument(db, tid, eid, yyyyMm);
  if ((monthly?.bonusRelatedRemuneration ?? 0) <= 0) {
    return new Set();
  }

  const latestRemuneration = await getLatestStandardRemuneration(db, tid, eid, yyyyMm);
  if (!latestRemuneration || latestRemuneration.source !== 'teiji') {
    return new Set();
  }

  const teijiYear = teijiYearFromEffectiveFrom(latestRemuneration.effectiveFrom);
  const { from, to } = teijiBonusLookbackRange(teijiYear);
  const lookbackRecords = await listBonusRecordsInRange(db, tid, eid, from, to);
  return getTeijiEligibleBonusTypes(lookbackRecords, bonusDefs);
}

async function sumFiscalYearHealthStandard(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<number> {
  const fiscalStart = fiscalYearStartYyyyMm(yyyyMm);
  const history = await listStandardBonus(db, tid, eid);
  return history
    .filter(
      (item) =>
        item.yyyyMm < yyyyMm && isYyyyMmInFiscalYear(item.yyyyMm, fiscalStart),
    )
    .reduce((sum, item) => sum + item.doc.standardBonus.health, 0);
}

function toSavePayload(doc: StandardBonusDocument): StandardBonusSavePayload {
  return omitUndefinedFields({
    standardBonus: doc.standardBonus,
    source: doc.source,
    effectiveFrom: doc.effectiveFrom,
    bonusAmount: doc.bonusAmount,
    rawStandardBonus: doc.rawStandardBonus,
    skipReason: doc.skipReason,
  });
}

async function loadContext(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<CalculationContext> {
  const [employee, bonus] = await Promise.all([
    getEmployee(db, tid, eid),
    getBonusDocument(db, tid, eid, yyyyMm),
  ]);

  if (!bonus || !hasBonusData(bonus.bonusData)) {
    throw new Error(`${yyyyMm} の賞与データがありません。`);
  }

  return {
    employee,
    bonus,
    birthDate: toFormDate(employee.employeePersonalInfo?.birthDate),
  };
}

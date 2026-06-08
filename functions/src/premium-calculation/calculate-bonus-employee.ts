import * as admin from 'firebase-admin';
import type { BonusDocument } from '../../../shared/bonus-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { calculateBonusPremium } from '../../../shared/social-insurance/premium/premium-calculator';
import { determineStandardBonus } from '../../../shared/social-insurance/bonus/standard-bonus-determination';
import {
  fiscalYearStartYyyyMm,
  isYyyyMmInFiscalYear,
  lastDayOfYyyyMm,
} from '../../../shared/social-insurance/bonus/social-insurance-data.util';
import { toFormDate } from '../../../shared/date-utils';
import {
  getBonusDocument,
  getEmployee,
  getStandardBonus,
  listStandardBonus,
  resolveInsuranceRateForBonus,
  saveStandardBonus,
  type StandardBonusDocument,
  type StandardBonusSavePayload,
} from './repos';

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
  const ctx = await loadContext(db, tid, eid, yyyyMm);
  const standardBonus = await resolveStandardBonus(db, tid, eid, yyyyMm, ctx);
  await saveStandardBonus(db, tid, eid, yyyyMm, standardBonus);

  const rate = await resolveInsuranceRateForBonus(db, tid, yyyyMm);
  if (!rate) {
    throw new Error('保険料率が見つかりません');
  }

  const premiumData = calculateBonusPremium({
    yyyyMm,
    birthDate: ctx.birthDate,
    standardBonus: standardBonus.standardBonus,
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
    standardBonus: standardBonus.standardBonus,
    bonusAmount: standardBonus.bonusAmount,
    rawStandardBonus: standardBonus.rawStandardBonus,
    source: standardBonus.source,
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection('tenants')
    .doc(tid)
    .collection('bonus-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid)
    .update({
      premiumData,
      calculationSnapshot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

  const bonusAmount = ctx.bonus.bonusData?.total ?? 0;
  if (bonusAmount <= 0) {
    throw new Error(`${yyyyMm} の賞与支給額がありません。`);
  }

  const fiscalYearHealthStandardSum = await sumFiscalYearHealthStandard(
    db,
    tid,
    eid,
    yyyyMm,
  );

  const determined = determineStandardBonus({
    bonusAmount,
    fiscalYearHealthStandardSum,
  });

  return {
    standardBonus: determined.standardBonus,
    source: 'calculated',
    effectiveFrom: lastDayOfYyyyMm(yyyyMm),
    bonusAmount: determined.bonusAmount,
    rawStandardBonus: determined.rawStandardBonus,
  };
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
  return {
    standardBonus: doc.standardBonus,
    source: doc.source,
    effectiveFrom: doc.effectiveFrom,
    bonusAmount: doc.bonusAmount,
    rawStandardBonus: doc.rawStandardBonus,
  };
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

  if (!bonus?.bonusData?.total) {
    throw new Error(`${yyyyMm} の賞与データがありません。`);
  }

  return {
    employee,
    bonus,
    birthDate: toFormDate(employee.employeePersonalInfo?.birthDate),
  };
}
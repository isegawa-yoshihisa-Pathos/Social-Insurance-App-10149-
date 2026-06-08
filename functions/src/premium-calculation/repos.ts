import * as admin from 'firebase-admin';
import type { BonusDocument } from '../../../shared/bonus-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import { lastDayOfYyyyMm } from '../../../shared/social-insurance/monthly/social-insurance-data.util';

export type StandardRemunerationSource =
  | 'initial'
  | 'teiji'
  | 'zuiji'
  | 'manual'
  | 'carried';

export interface StandardRemunerationDocument {
  healthGrade: number;
  pensionGrade: number;
  standardRemuneration: { health: number; pension: number };
  source: StandardRemunerationSource;
  effectiveFrom: string;
  remuneration?: number;
}

export type StandardRemunerationSavePayload = StandardRemunerationDocument;

export interface StandardRemunerationListItem {
  yyyyMm: string;
  doc: StandardRemunerationDocument;
}

export type StandardBonusSource = 'calculated' | 'manual';

export interface StandardBonusDocument {
  standardBonus: { health: number; pension: number };
  source: StandardBonusSource;
  effectiveFrom: string;
  bonusAmount: number;
  rawStandardBonus: number;
}

export type StandardBonusSavePayload = StandardBonusDocument;

export interface StandardBonusListItem {
  yyyyMm: string;
  doc: StandardBonusDocument;
}

export interface ResolvedInsuranceRate {
  rateId: string;
  effectiveFrom: string;
  rates: {
    healthInsuranceRate: number;
    careInsuranceRate: number;
    pensionInsuranceRate: number;
  };
  employeeRate: {
    healthInsurance: number;
    careInsurance: number;
    pensionInsurance: number;
  };
  roundingBy: {
    healthInsurance: number;
    careInsurance: number;
    pensionInsurance: number;
  };
}

interface InsuranceRateDocument {
  effectiveFrom: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  employeeRate: ResolvedInsuranceRate['employeeRate'];
  roundingBy: ResolvedInsuranceRate['roundingBy'];
}

function standardRemunerationRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .doc(eid)
    .collection('standardRemuneration')
    .doc(yyyyMm);
}

function standardBonusRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .doc(eid)
    .collection('standardBonus')
    .doc(yyyyMm);
}

export async function getEmployee(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
): Promise<EmployeeDocument> {
  const snap = await db.collection('tenants').doc(tid).collection('employees').doc(eid).get();
  if (!snap.exists) throw new Error('従業員が見つかりません。');
  return snap.data() as EmployeeDocument;
}

export async function getMonthlyDocument(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<MonthlyDocument | null> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('monthly-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid)
    .get();
  if (!snap.exists) return null;
  return snap.data() as MonthlyDocument;
}

export async function getBonusDocument(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<BonusDocument | null> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('bonus-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid)
    .get();
  if (!snap.exists) return null;
  return snap.data() as BonusDocument;
}

export async function getStandardRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<StandardRemunerationDocument | null> {
  const snap = await standardRemunerationRef(db, tid, eid, yyyyMm).get();
  if (!snap.exists) return null;
  return snap.data() as StandardRemunerationDocument;
}

export async function listStandardRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
): Promise<StandardRemunerationListItem[]> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .doc(eid)
    .collection('standardRemuneration')
    .get();
  return snap.docs
    .map((d) => ({ yyyyMm: d.id, doc: d.data() as StandardRemunerationDocument }))
    .sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));
}

export async function getLatestStandardRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<StandardRemunerationSavePayload | null> {
  const history = await listStandardRemuneration(db, tid, eid);
  const found = history.find((item) => item.yyyyMm <= yyyyMm);
  return found?.doc ?? null;
}

export async function saveStandardRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  payload: StandardRemunerationSavePayload,
): Promise<void> {
  const ref = standardRemunerationRef(db, tid, eid, yyyyMm);
  const existing = await ref.get();
  await ref.set(
    {
      ...payload,
      createdAt: existing.exists
        ? existing.data()?.createdAt
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getStandardBonus(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<StandardBonusDocument | null> {
  const snap = await standardBonusRef(db, tid, eid, yyyyMm).get();
  if (!snap.exists) return null;
  return snap.data() as StandardBonusDocument;
}

export async function listStandardBonus(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
): Promise<StandardBonusListItem[]> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .doc(eid)
    .collection('standardBonus')
    .get();
  return snap.docs
    .map((d) => ({ yyyyMm: d.id, doc: d.data() as StandardBonusDocument }))
    .sort((a, b) => b.yyyyMm.localeCompare(a.yyyyMm));
}

export async function saveStandardBonus(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  payload: StandardBonusSavePayload,
): Promise<void> {
  const ref = standardBonusRef(db, tid, eid, yyyyMm);
  const existing = await ref.get();
  await ref.set(
    {
      ...payload,
      createdAt: existing.exists
        ? existing.data()?.createdAt
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function resolveInsuranceRate(
  db: admin.firestore.Firestore,
  tid: string,
  targetDate: string,
): Promise<ResolvedInsuranceRate | null> {
  const snap = await db.collection('tenants').doc(tid).collection('insuranceRates').get();
  const rows = snap.docs
    .map((d) => ({ rateId: d.id, doc: d.data() as InsuranceRateDocument }))
    .filter((r) => r.doc.effectiveFrom <= targetDate)
    .sort((a, b) => b.doc.effectiveFrom.localeCompare(a.doc.effectiveFrom));

  if (rows.length === 0) return null;
  const best = rows[0];
  return {
    rateId: best.rateId,
    effectiveFrom: best.doc.effectiveFrom,
    rates: {
      healthInsuranceRate: best.doc.healthInsuranceRate,
      careInsuranceRate: best.doc.careInsuranceRate,
      pensionInsuranceRate: best.doc.pensionInsuranceRate,
    },
    employeeRate: best.doc.employeeRate,
    roundingBy: best.doc.roundingBy,
  };
}

export async function resolveInsuranceRateForMonth(
  db: admin.firestore.Firestore,
  tid: string,
  yyyyMm: string,
): Promise<ResolvedInsuranceRate | null> {
  return resolveInsuranceRate(db, tid, lastDayOfYyyyMm(yyyyMm));
}

export async function resolveInsuranceRateForBonus(
  db: admin.firestore.Firestore,
  tid: string,
  yyyyMm: string,
): Promise<ResolvedInsuranceRate | null> {
  return resolveInsuranceRate(db, tid, lastDayOfYyyyMm(yyyyMm));
}
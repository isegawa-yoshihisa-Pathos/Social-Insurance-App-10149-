import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { determineStandardZuiji } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { PreviousGrades } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { ResolvedStandardRemuneration } from '../../../shared/social-insurance/remuneration/grade-table/index';
import {
  addYyyyMm,
  getMayJuneZuijiSchedule,
} from '../../../shared/social-insurance/remuneration/may-june-zuiji';
import {
  isTeijiReplacementZuijiEffectiveMonth,
  teijiYearFromEffectiveMonth,
  withBonusRelatedRemuneration,
} from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import {
  computeTeijiBonusRelatedRemuneration,
  applyTeijiBonusRelatedRemunerationToMonthlyRecords,
} from './teiji-bonus-remuneration';
import { parseYyyyMm } from '../../../shared/social-insurance/monthly/social-insurance-data.util';
import type { MonthlyRemunerationSource } from '../../../shared/social-insurance/remuneration/remuneration-month-input';
import { computeFixedWageFromPayroll } from '../../../shared/social-insurance/remuneration/fixed-wage';
import {
  getMonthlyDocument,
  listStandardRemuneration,
  getStandardRemuneration,
  getLatestConfirmedStandardRemuneration,
  saveStandardRemuneration,
  isConfirmedStandardRemunerationSource,
  type StandardRemunerationSavePayload,
} from './repos';

export type MayJuneZuijiReviewStatus = 'pending_review' | 'approved' | 'rejected';

export interface MayJuneZuijiReviewDocument {
  eid: string;
  raiseMonthYyyyMm: string;
  effectiveYyyyMm: string;
  screeningYyyyMm: string;
  employeeDisplayName: string;
  status: MayJuneZuijiReviewStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  reviewedAt?: admin.firestore.Timestamp;
  reviewedByUid?: string;
}

export interface MayJuneZuijiFinalizeResult {
  payload: StandardRemunerationSavePayload;
  raiseMonthYyyyMm: string;
  previous: PreviousGrades;
  grades: ResolvedStandardRemuneration;
}

export function mayJuneZuijiReviewDocId(eid: string, raiseMonthYyyyMm: string): string {
  return `${eid}_${raiseMonthYyyyMm}`;
}

function reviewRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  raiseMonthYyyyMm: string,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('mayJuneZuijiReviews')
    .doc(mayJuneZuijiReviewDocId(eid, raiseMonthYyyyMm));
}

export async function getMayJuneZuijiReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  raiseMonthYyyyMm: string,
): Promise<MayJuneZuijiReviewDocument | null> {
  const snap = await reviewRef(db, tid, eid, raiseMonthYyyyMm).get();
  if (!snap.exists) return null;
  return snap.data() as MayJuneZuijiReviewDocument;
}

export async function ensureMayJuneZuijiReviewPending(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  raiseMonthYyyyMm: string,
  employeeDisplayName: string,
): Promise<{ created: boolean; review: MayJuneZuijiReviewDocument }> {
  const schedule = getMayJuneZuijiSchedule(raiseMonthYyyyMm);
  const ref = reviewRef(db, tid, eid, raiseMonthYyyyMm);
  const existing = await ref.get();
  if (existing.exists) {
    return {
      created: false,
      review: existing.data() as MayJuneZuijiReviewDocument,
    };
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const review: Omit<MayJuneZuijiReviewDocument, 'createdAt' | 'updatedAt'> & {
    createdAt: admin.firestore.FieldValue;
    updatedAt: admin.firestore.FieldValue;
  } = {
    eid,
    raiseMonthYyyyMm,
    effectiveYyyyMm: schedule.effectiveYyyyMm,
    screeningYyyyMm: schedule.screeningYyyyMm,
    employeeDisplayName,
    status: 'pending_review',
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(review);

  const saved = await ref.get();
  return {
    created: true,
    review: saved.data() as MayJuneZuijiReviewDocument,
  };
}

/** 7・8・9月適用の随時改定（確定 or 仮）があれば定時決定をスキップ */
export async function hasTeijiReplacementZuijiForYear(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
): Promise<boolean> {
  const history = await listStandardRemuneration(db, tid, eid);
  return history.some(
    (item) =>
      (item.doc.source === 'zuiji' || item.doc.source === 'provisional_zuiji') &&
      isTeijiReplacementZuijiEffectiveMonth(item.yyyyMm) &&
      teijiYearFromEffectiveMonth(item.yyyyMm) === teijiYear,
  );
}

async function loadMonthSourcesForMayJuneZuiji(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  raiseMonthYyyyMm: string,
): Promise<{
  zuijiSources: MonthlyRemunerationSource[];
  previous: PreviousGrades;
  fixedWageBeforeChange: number;
} | null> {
  const priorMonthKey = addYyyyMm(raiseMonthYyyyMm, -1);
  const zuijiMonthKeys = [
    raiseMonthYyyyMm,
    addYyyyMm(raiseMonthYyyyMm, 1),
    addYyyyMm(raiseMonthYyyyMm, 2),
  ];

  const priorMonthly = await getMonthlyDocument(db, tid, eid, priorMonthKey);
  if (!priorMonthly?.payrollData) return null;

  const zuijiSources = await Promise.all(
    zuijiMonthKeys.map((ym) => loadMonthlyRemunerationSource(db, tid, eid, ym)),
  );
  if (zuijiSources.some((s) => s == null)) return null;

  const priorPayroll =
    priorMonthly.payrollData.fixedWage ?? priorMonthly.payrollData.basicSalary;
  const raisePayroll =
    zuijiSources[0]!.payroll.fixedWage ?? zuijiSources[0]!.payroll.basicSalary;
  if (priorPayroll === raisePayroll) return null;

  const previous = await getPreviousGrades(db, tid, eid, priorMonthKey);
  if (!previous) return null;

  return {
    zuijiSources: zuijiSources as MonthlyRemunerationSource[],
    previous,
    fixedWageBeforeChange: computeFixedWageFromPayroll(priorMonthly.payrollData),
  };
}

async function loadMonthlyRemunerationSource(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<MonthlyRemunerationSource | null> {
  const monthly = await getMonthlyDocument(db, tid, eid, yyyyMm);
  if (!monthly?.payrollData) return null;
  return {
    yyyyMm,
    hasMonthlyRecord: true,
    daysInMonth: daysInMonth(yyyyMm),
    payroll: monthly.payrollData,
    paymentBaseDays: monthly.paymentBaseDays,
    bonusRelatedRemuneration: monthly.bonusRelatedRemuneration ?? 0,
  };
}

function daysInMonth(yyyyMm: string): number {
  const { year, month } = parseYyyyMm(yyyyMm);
  return new Date(year, month, 0).getDate();
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

function gradesToZuijiPayload(
  effectiveFrom: string,
  grades: {
    health: { grade: number; standardRemuneration: number };
    pension: { grade: number; standardRemuneration: number };
    remuneration: number;
  },
  bonusRemunerationMonthlyAddition?: number,
): StandardRemunerationSavePayload {
  return {
    healthGrade: grades.health.grade,
    pensionGrade: grades.pension.grade,
    standardRemuneration: {
      health: grades.health.standardRemuneration,
      pension: grades.pension.standardRemuneration,
    },
    source: 'zuiji',
    effectiveFrom,
    remuneration: grades.remuneration,
    bonusRemunerationMonthlyAddition,
  };
}

/** 承認時: 従前の標準報酬を引き継ぎ、仮随時フラグのみ立てる */
export async function saveProvisionalMayJuneZuijiOnApproval(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  raiseMonthYyyyMm: string,
): Promise<StandardRemunerationSavePayload> {
  const schedule = getMayJuneZuijiSchedule(raiseMonthYyyyMm);
  const priorKey = addYyyyMm(raiseMonthYyyyMm, -1);
  const prior = await getLatestConfirmedStandardRemuneration(db, tid, eid, priorKey);
  if (!prior) {
    throw new Error('従前の標準報酬月額が見つかりません。');
  }

  const payload: StandardRemunerationSavePayload = {
    healthGrade: prior.healthGrade,
    pensionGrade: prior.pensionGrade,
    standardRemuneration: { ...prior.standardRemuneration },
    source: 'provisional_zuiji',
    effectiveFrom: schedule.effectiveYyyyMm,
    remuneration: prior.remuneration,
  };
  await saveStandardRemuneration(db, tid, eid, schedule.effectiveYyyyMm, payload);
  return payload;
}

/**
 * 承認済み仮随時を、3ヶ月データが揃ったスクリーニング月に本随時へ確定する。
 * 5月昇給→7月、6月昇給→8月の計算時に実行。
 */
export async function tryFinalizeApprovedMayJuneZuiji(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
): Promise<MayJuneZuijiFinalizeResult | null> {
  const { year } = parseYyyyMm(yyyyMm);

  for (const raiseMonth of [5, 6] as const) {
    const raiseMonthYyyyMm = `${year}-${String(raiseMonth).padStart(2, '0')}`;
    const review = await getMayJuneZuijiReview(db, tid, eid, raiseMonthYyyyMm);
    if (!review || review.status !== 'approved') continue;

    const schedule = getMayJuneZuijiSchedule(raiseMonthYyyyMm);
    if (yyyyMm !== schedule.screeningYyyyMm) continue;

    const existing = await getStandardRemuneration(db, tid, eid, schedule.effectiveYyyyMm);
    if (existing?.source === 'zuiji') continue;
    if (existing?.source !== 'provisional_zuiji') continue;

    const loaded = await loadMonthSourcesForMayJuneZuiji(db, tid, eid, raiseMonthYyyyMm);
    if (!loaded) continue;

    const effectiveFrom = schedule.effectiveYyyyMm;
    let zuijiSources = loaded.zuijiSources;
    let teijiPeriodBonusAddition: number | undefined;
    let teijiPeriodBonusQualifies = false;

    if (isTeijiReplacementZuijiEffectiveMonth(effectiveFrom)) {
      const teijiYear = teijiYearFromEffectiveMonth(effectiveFrom);
      const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
      teijiPeriodBonusQualifies = teijiBonus.qualifies;
      if (teijiBonus.qualifies) {
        teijiPeriodBonusAddition = teijiBonus.addition;
        zuijiSources = withBonusRelatedRemuneration(zuijiSources, teijiBonus.addition);
      }
    }

    const outcome = determineStandardZuiji(
      employmentType,
      zuijiSources,
      loaded.previous,
      { fixedWageBeforeChange: loaded.fixedWageBeforeChange },
    );
    if (outcome.kind !== 'applicable') continue;

    const payload = gradesToZuijiPayload(
      effectiveFrom,
      outcome.grades,
      teijiPeriodBonusQualifies && teijiPeriodBonusAddition != null && teijiPeriodBonusAddition > 0
        ? teijiPeriodBonusAddition
        : undefined,
    );
    await saveStandardRemuneration(db, tid, eid, schedule.effectiveYyyyMm, payload);

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
      payload,
      raiseMonthYyyyMm,
      previous: loaded.previous,
      grades: outcome.grades,
    };
  }

  return null;
}

async function assertTenantAdmin(
  db: admin.firestore.Firestore,
  tid: string,
  uid: string,
): Promise<void> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .where('uid', '==', uid)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc || doc.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', '管理者権限が必要です。');
  }
}

interface ReviewActionInput {
  tid: string;
  eid: string;
  raiseMonthYyyyMm: string;
}

export const approveMayJuneZuijiReview = onCall<ReviewActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const eid = String(request.data?.eid ?? '').trim();
    const raiseMonthYyyyMm = String(request.data?.raiseMonthYyyyMm ?? '').trim();
    if (!tid || !eid || !raiseMonthYyyyMm) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = reviewRef(db, tid, eid, raiseMonthYyyyMm);
    const reviewSnap = await ref.get();
    if (!reviewSnap.exists) {
      throw new HttpsError('not-found', '随時改定の確認依頼が見つかりません。');
    }
    const review = reviewSnap.data() as MayJuneZuijiReviewDocument;
    if (review.status === 'approved') {
      return { status: 'approved' as const };
    }
    if (review.status === 'rejected') {
      throw new HttpsError('failed-precondition', '却下済みの確認依頼です。');
    }

    await saveProvisionalMayJuneZuijiOnApproval(db, tid, eid, raiseMonthYyyyMm);

    await ref.set(
      {
        status: 'approved',
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedByUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { status: 'approved' as const };
  },
);

export const rejectMayJuneZuijiReview = onCall<ReviewActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const eid = String(request.data?.eid ?? '').trim();
    const raiseMonthYyyyMm = String(request.data?.raiseMonthYyyyMm ?? '').trim();
    if (!tid || !eid || !raiseMonthYyyyMm) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = reviewRef(db, tid, eid, raiseMonthYyyyMm);
    const reviewSnap = await ref.get();
    if (!reviewSnap.exists) {
      throw new HttpsError('not-found', '随時改定の確認依頼が見つかりません。');
    }
    const review = reviewSnap.data() as MayJuneZuijiReviewDocument;
    if (review.status === 'rejected') {
      return { status: 'rejected' as const };
    }

    await ref.set(
      {
        status: 'rejected',
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedByUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { status: 'rejected' as const };
  },
);

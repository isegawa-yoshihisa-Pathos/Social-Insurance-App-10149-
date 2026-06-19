import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import type { EmployeeLeaveType } from '../../../shared/employee-document';
import {
  buildAnnualAveragePeriodMonthKeys,
  screenAnnualAverageCandidate,
  screenZuijiAnnualAverageCandidate,
  buildZuijiAnnualAverageLoadKeys,
  type AnnualAverageMonthInput,
} from '../../../shared/social-insurance/remuneration/annual-average-determination';
import {
  buildLeaveReturnRemunerationNotificationBody,
  leaveTypeLabel,
} from '../../../shared/social-insurance/remuneration/leave-return-remuneration-determination';
import type { PreviousGrades } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { ResolvedStandardRemuneration } from '../../../shared/social-insurance/remuneration/grade-table/index';
import type { StandardRemunerationSource } from './repos';
import type { MonthlyRemunerationSource } from '../../../shared/social-insurance/remuneration/remuneration-month-input';
import {
  isTeijiReplacementZuijiEffectiveMonth,
  teijiYearFromEffectiveMonth,
} from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import { addMonths, daysInMonth } from '../../../shared/social-insurance/monthly/social-insurance-data.util';
import {
  getMonthlyDocument,
  saveStandardRemuneration,
  type StandardRemunerationSavePayload,
} from './repos';
import {
  applyTeijiBonusRelatedRemunerationToMonthlyRecords,
  computeTeijiBonusRelatedRemuneration,
} from './teiji-bonus-remuneration';
import {
  leaveReturnReviewId,
  teijiAnnualAverageReviewId,
  zuijiAnnualAverageReviewId,
} from './remuneration-review-ids';

export type RemunerationConsentReviewType =
  | 'teiji_annual_average'
  | 'zuiji_annual_average'
  | 'leave_return';

export type RemunerationConsentReviewStatus =
  | 'pending_employee_consent'
  | 'employee_declined'
  | 'pending_admin_review'
  | 'approved'
  | 'rejected';

export interface RemunerationConsentReviewDocument {
  type: RemunerationConsentReviewType;
  eid: string;
  employeeDisplayName: string;
  status: RemunerationConsentReviewStatus;
  effectiveFrom: string;
  proposedHealthGrade: number;
  proposedPensionGrade: number;
  proposedHealthStandardRemuneration: number;
  proposedPensionStandardRemuneration: number;
  proposedRemuneration: number;
  summaryBody: string;
  context: Record<string, unknown>;
  employeeConsent?: 'agreed' | 'declined';
  employeeConsentedAt?: admin.firestore.Timestamp;
  reviewedByUid?: string;
  reviewedAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

function collectionRef(db: admin.firestore.Firestore, tid: string) {
  return db.collection('tenants').doc(tid).collection('remunerationConsentReviews');
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

async function loadMonthSources(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  monthKeys: string[],
): Promise<MonthlyRemunerationSource[]> {
  const sources: MonthlyRemunerationSource[] = [];
  for (const ym of monthKeys) {
    const source = await loadMonthlyRemunerationSource(db, tid, eid, ym);
    if (source) sources.push(source);
  }
  return sources;
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

function reviewToPayload(
  review: RemunerationConsentReviewDocument,
  source: StandardRemunerationSource,
  bonusRemunerationMonthlyAddition?: number,
): StandardRemunerationSavePayload {
  return {
    healthGrade: review.proposedHealthGrade,
    pensionGrade: review.proposedPensionGrade,
    standardRemuneration: {
      health: review.proposedHealthStandardRemuneration,
      pension: review.proposedPensionStandardRemuneration,
    },
    source,
    effectiveFrom: review.effectiveFrom,
    remuneration: review.proposedRemuneration,
    bonusRemunerationMonthlyAddition,
  };
}

async function ensureReview(
  db: admin.firestore.Firestore,
  tid: string,
  reviewId: string,
  data: Omit<
    RemunerationConsentReviewDocument,
    'createdAt' | 'updatedAt' | 'status' | 'employeeConsent' | 'employeeConsentedAt' | 'reviewedByUid' | 'reviewedAt'
  >,
): Promise<{ created: boolean }> {
  const ref = collectionRef(db, tid).doc(reviewId);
  const existing = await ref.get();
  if (existing.exists) {
    return { created: false };
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await ref.set({
    ...data,
    status: 'pending_employee_consent',
    createdAt: now,
    updatedAt: now,
  });
  return { created: true };
}

async function notifyEmployeeConsent(
  db: admin.firestore.Firestore,
  uid: string,
  input: {
    type: string;
    title: string;
    body: string;
    reviewId: string;
    tid: string;
    targetEid: string;
  },
): Promise<void> {
  await db.collection('accounts').doc(uid).collection('notifications').add({
    scope: 'personal',
    type: input.type,
    title: input.title,
    body: input.body,
    reviewId: input.reviewId,
    tid: input.tid,
    targetEid: input.targetEid,
    dedupeKey: `consent_${input.reviewId}`,
    status: 'assigned',
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function notifyAdminReview(
  db: admin.firestore.Firestore,
  tid: string,
  input: {
    type: string;
    title: string;
    body: string;
    reviewId: string;
    targetEid: string;
    dedupeKey: string;
  },
): Promise<void> {
  const admins = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .where('role', '==', 'admin')
    .get();

  for (const adminDoc of admins.docs) {
    const uid = adminDoc.data()?.uid as string | undefined;
    if (!uid) continue;

    await db.collection('accounts').doc(uid).collection('notifications').add({
      scope: 'tenant',
      type: input.type,
      title: input.title,
      body: input.body,
      reviewId: input.reviewId,
      targetEid: input.targetEid,
      dedupeKey: input.dedupeKey,
      status: 'pending_review',
      read: false,
      tid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

export async function ensureTeijiAnnualAverageConsentReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  screeningYyyyMm: string,
  teijiYear: number,
  employeeDisplayName: string,
  employeeUid: string | undefined,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
  teijiHealthGrade: number,
  teijiPensionGrade: number,
): Promise<{ created: boolean; annualGrades?: ResolvedStandardRemuneration }> {
  const periodKeys = buildAnnualAveragePeriodMonthKeys(`${teijiYear}-07`);
  const annualSources = await loadMonthSources(db, tid, eid, periodKeys);
  const screening = screenAnnualAverageCandidate(
    employmentType,
    { teijiHealthGrade, teijiPensionGrade },
    toAnnualAverageMonthInputs(annualSources),
  );
  if (screening.kind !== 'candidate') return { created: false };

  const reviewId = teijiAnnualAverageReviewId(eid, teijiYear);
  const effectiveFrom = `${teijiYear}-09`;
  const grades = screening.annualAverage.grades;
  const summaryBody =
    `定時決定等級 ${teijiHealthGrade}/${teijiPensionGrade} → ` +
    `年間平均等級 ${grades.health.grade}/${grades.pension.grade}（${effectiveFrom}適用）`;

  await ensureReview(db, tid, reviewId, {
    type: 'teiji_annual_average',
    eid,
    employeeDisplayName,
    effectiveFrom,
    proposedHealthGrade: grades.health.grade,
    proposedPensionGrade: grades.pension.grade,
    proposedHealthStandardRemuneration: grades.health.standardRemuneration,
    proposedPensionStandardRemuneration: grades.pension.standardRemuneration,
    proposedRemuneration: grades.remuneration,
    summaryBody,
    context: {
      teijiYear,
      screeningYyyyMm,
      teijiHealthGrade,
      teijiPensionGrade,
      healthDiff: screening.healthDiff,
      pensionDiff: screening.pensionDiff,
      averageRemuneration: screening.annualAverage.averageRemuneration,
      divisor: screening.annualAverage.divisor,
    },
  });

  if (employeeUid) {
    await notifyEmployeeConsent(db, employeeUid, {
      type: 'annual_average_consent',
      title: '【社会保険】定時決定における年間平均適用の同意確認',
      body: '年間平均算定の適用候補となっています。タスクボードの「標準報酬月額の同意確認」から内容を確認し、回答してください。',
      reviewId,
      tid,
      targetEid: eid,
    });
  }

  await notifyAdminReview(db, tid, {
    type: 'annualAverageSuggestion',
    title: `【年間平均算定】${employeeDisplayName}様（本人同意待ち）`,
    body: summaryBody,
    reviewId,
    targetEid: eid,
    dedupeKey: `${reviewId}_admin`,
  });
  return { created: true, annualGrades: grades };
}

export async function ensureZuijiAnnualAverageConsentReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employeeDisplayName: string,
  employeeUid: string | undefined,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
  currentGrades: PreviousGrades,
  normalZuijiGrades: ResolvedStandardRemuneration,
  changeMonthYyyyMm: string,
): Promise<void> {
  const loadKeys = buildZuijiAnnualAverageLoadKeys(changeMonthYyyyMm);
  const annualSources = await loadMonthSources(db, tid, eid, loadKeys);
  const screening = screenZuijiAnnualAverageCandidate(
    employmentType,
    currentGrades,
    normalZuijiGrades,
    changeMonthYyyyMm,
    toAnnualAverageMonthInputs(annualSources),
  );
  if (screening.kind !== 'candidate') return;

  const reviewId = zuijiAnnualAverageReviewId(eid, changeMonthYyyyMm);
  const effectiveFrom = addMonths(changeMonthYyyyMm, 3);
  const grades = screening.annualAverage.grades;
  const summaryBody =
    `通常随時 ${normalZuijiGrades.health.grade}/${normalZuijiGrades.pension.grade} → ` +
    `年間平均等級 ${grades.health.grade}/${grades.pension.grade}（${effectiveFrom}適用）`;

  await ensureReview(db, tid, reviewId, {
    type: 'zuiji_annual_average',
    eid,
    employeeDisplayName,
    effectiveFrom,
    proposedHealthGrade: grades.health.grade,
    proposedPensionGrade: grades.pension.grade,
    proposedHealthStandardRemuneration: grades.health.standardRemuneration,
    proposedPensionStandardRemuneration: grades.pension.standardRemuneration,
    proposedRemuneration: grades.remuneration,
    summaryBody,
    context: {
      changeMonthYyyyMm,
      normalHealthGrade: normalZuijiGrades.health.grade,
      normalPensionGrade: normalZuijiGrades.pension.grade,
      currentHealthGrade: currentGrades.healthGrade,
      currentPensionGrade: currentGrades.pensionGrade,
      averageRemuneration: screening.annualAverage.averageRemuneration,
    },
  });

  if (employeeUid) {
    await notifyEmployeeConsent(db, employeeUid, {
      type: 'zuiji_annual_average_consent',
      title: '【社会保険】随時改定における年間平均適用の同意確認',
      body: '年間平均算定の適用候補となっています。タスクボードの「標準報酬月額の同意確認」から内容を確認し、回答してください。',
      reviewId,
      tid,
      targetEid: eid,
    });
  }

  await notifyAdminReview(db, tid, {
    type: 'zuijiAnnualAverageSuggestion',
    title: `【随時改定・年間平均】${employeeDisplayName}様（本人同意待ち）`,
    body: summaryBody,
    reviewId,
    targetEid: eid,
    dedupeKey: `${reviewId}_admin`,
  });
}

export async function ensureLeaveReturnConsentReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employeeDisplayName: string,
  employeeUid: string | undefined,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
  input: {
    leaveType: EmployeeLeaveType;
    leaveEndYyyyMm: string;
    returnStartYyyyMm: string;
    screeningYyyyMm: string;
    effectiveYyyyMm: string;
    measurementMonthKeys: string[];
    previous: PreviousGrades;
    grades: ResolvedStandardRemuneration;
    averageRemuneration: number;
    healthDiff: number;
    pensionDiff: number;
  },
): Promise<void> {
  const reviewId = leaveReturnReviewId(eid, input.leaveEndYyyyMm);
  const summaryBody = buildLeaveReturnRemunerationNotificationBody({
    employeeName: employeeDisplayName,
    leaveType: input.leaveType,
    leaveEndYyyyMm: input.leaveEndYyyyMm,
    effectiveYyyyMm: input.effectiveYyyyMm,
    currentGrades: input.previous,
    proposedGrades: input.grades,
    averageRemuneration: input.averageRemuneration,
    healthDiff: input.healthDiff,
    pensionDiff: input.pensionDiff,
    employmentType,
  });

  await ensureReview(db, tid, reviewId, {
    type: 'leave_return',
    eid,
    employeeDisplayName,
    effectiveFrom: input.effectiveYyyyMm,
    proposedHealthGrade: input.grades.health.grade,
    proposedPensionGrade: input.grades.pension.grade,
    proposedHealthStandardRemuneration: input.grades.health.standardRemuneration,
    proposedPensionStandardRemuneration: input.grades.pension.standardRemuneration,
    proposedRemuneration: input.grades.remuneration,
    summaryBody,
    context: {
      leaveType: input.leaveType,
      leaveEndYyyyMm: input.leaveEndYyyyMm,
      returnStartYyyyMm: input.returnStartYyyyMm,
      screeningYyyyMm: input.screeningYyyyMm,
      measurementMonthKeys: input.measurementMonthKeys,
      currentHealthGrade: input.previous.healthGrade,
      currentPensionGrade: input.previous.pensionGrade,
      averageRemuneration: input.averageRemuneration,
      healthDiff: input.healthDiff,
      pensionDiff: input.pensionDiff,
    },
  });

  if (employeeUid) {
    await notifyEmployeeConsent(db, employeeUid, {
      type: 'leave_return_remuneration_consent',
      title: '【社会保険】休業明けの標準報酬月額調整の同意確認',
      body: '休業明けの標準報酬月額調整候補となっています。タスクボードの「標準報酬月額の同意確認」から内容を確認し、回答してください。',
      reviewId,
      tid,
      targetEid: eid,
    });
  }

  await notifyAdminReview(db, tid, {
    type: 'leaveReturnRemunerationSuggestion',
    title: `【休業明け標準報酬】${employeeDisplayName}様（${leaveTypeLabel(input.leaveType)}・本人同意待ち）`,
    body: summaryBody,
    reviewId,
    targetEid: eid,
    dedupeKey: `${reviewId}_admin`,
  });
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

async function assertOwnEmployee(
  db: admin.firestore.Firestore,
  tid: string,
  uid: string,
  eid: string,
): Promise<void> {
  const snap = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .where('uid', '==', uid)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc || doc.id !== eid) {
    throw new HttpsError('permission-denied', '本人のみ回答できます。');
  }
}

async function applyApprovedReview(
  db: admin.firestore.Firestore,
  tid: string,
  review: RemunerationConsentReviewDocument,
): Promise<void> {
  const { eid, type, effectiveFrom, context } = review;

  if (type === 'teiji_annual_average') {
    const teijiYear = Number(context['teijiYear']);
    const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
    const payload = reviewToPayload(
      review,
      'teiji',
      teijiBonus.qualifies && teijiBonus.addition > 0 ? teijiBonus.addition : undefined,
    );
    await saveStandardRemuneration(db, tid, eid, effectiveFrom, payload);
    if (teijiBonus.qualifies) {
      await applyTeijiBonusRelatedRemunerationToMonthlyRecords(
        db,
        tid,
        eid,
        teijiYear,
        teijiBonus.addition,
      );
    }
    return;
  }

  if (type === 'zuiji_annual_average') {
    let bonusAddition: number | undefined;
    if (isTeijiReplacementZuijiEffectiveMonth(effectiveFrom)) {
      const teijiYear = teijiYearFromEffectiveMonth(effectiveFrom);
      const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
      if (teijiBonus.qualifies) {
        bonusAddition = teijiBonus.addition > 0 ? teijiBonus.addition : undefined;
        await applyTeijiBonusRelatedRemunerationToMonthlyRecords(
          db,
          tid,
          eid,
          teijiYear,
          teijiBonus.addition,
          effectiveFrom,
        );
      }
    }
    const payload = reviewToPayload(review, 'zuiji', bonusAddition);
    await saveStandardRemuneration(db, tid, eid, effectiveFrom, payload);
    return;
  }

  if (type === 'leave_return') {
    const payload = reviewToPayload(review, 'zuiji');
    await saveStandardRemuneration(db, tid, eid, effectiveFrom, payload);
  }
}

interface ConsentActionInput {
  tid: string;
  reviewId: string;
}

export const submitRemunerationConsentReview = onCall<ConsentActionInput & { consent: 'agreed' | 'declined' }>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    const consent = request.data?.consent;
    if (!tid || !reviewId || (consent !== 'agreed' && consent !== 'declined')) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    const ref = collectionRef(db, tid).doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '同意確認依頼が見つかりません。');
    }

    const review = snap.data() as RemunerationConsentReviewDocument;
    await assertOwnEmployee(db, tid, uid, review.eid);

    if (review.status !== 'pending_employee_consent') {
      throw new HttpsError('failed-precondition', '回答済みまたは処理済みです。');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const nextStatus: RemunerationConsentReviewStatus =
      consent === 'agreed' ? 'pending_admin_review' : 'employee_declined';

    await ref.set(
      {
        status: nextStatus,
        employeeConsent: consent,
        employeeConsentedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    if (consent === 'agreed') {
      await notifyAdminReview(db, tid, {
        type: 'remunerationConsentReady',
        title: `【標準報酬月額】${review.employeeDisplayName}様が同意しました`,
        body: `${review.summaryBody}。管理者の承認・適用を行ってください。`,
        reviewId,
        targetEid: review.eid,
        dedupeKey: `${reviewId}_ready`,
      });
    }

    return { status: nextStatus };
  },
);

export const approveRemunerationConsentReview = onCall<ConsentActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    if (!tid || !reviewId) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = collectionRef(db, tid).doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '同意確認依頼が見つかりません。');
    }

    const review = snap.data() as RemunerationConsentReviewDocument;
    if (review.status === 'approved') {
      return { status: 'approved' as const };
    }
    if (review.status !== 'pending_admin_review') {
      throw new HttpsError('failed-precondition', '本人の同意後に承認できます。');
    }

    await applyApprovedReview(db, tid, review);

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(
      {
        status: 'approved',
        reviewedByUid: uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return { status: 'approved' as const };
  },
);

export const rejectRemunerationConsentReview = onCall<ConsentActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    if (!tid || !reviewId) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = collectionRef(db, tid).doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '同意確認依頼が見つかりません。');
    }

    const review = snap.data() as RemunerationConsentReviewDocument;
    if (review.status === 'rejected') {
      return { status: 'rejected' as const };
    }
    if (review.status !== 'pending_admin_review' && review.status !== 'pending_employee_consent') {
      throw new HttpsError('failed-precondition', '却下できない状態です。');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(
      {
        status: 'rejected',
        reviewedByUid: uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return { status: 'rejected' as const };
  },
);

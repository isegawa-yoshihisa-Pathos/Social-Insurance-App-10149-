import { resolveEmploymentType } from '../../../shared/employee-document';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  buildAnnualAveragePeriodMonthKeys,
  screenAnnualAverageCandidate,
  type AnnualAverageMonthInput,
} from '../../../shared/social-insurance/remuneration/annual-average-determination';
import { determineTeiji } from '../../../shared/social-insurance/remuneration/teiji-determination';
import type { ResolvedStandardRemuneration } from '../../../shared/social-insurance/remuneration/grade-table/index';
import type { MonthlyRemunerationSource } from '../../../shared/social-insurance/remuneration/remuneration-month-input';
import {
  applyRetroactiveToAnnualInputs,
  applyRetroactiveToMonthlySources,
  defaultRetroactiveReviewItem,
  normalizeRetroactiveReviewItems,
  validateRetroactiveReviewItems,
  type RetroactivePayDetectedItem,
  type RetroactivePayReviewItem,
} from '../../../shared/social-insurance/remuneration/retroactive-remuneration';
import { withBonusRelatedRemuneration } from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import { daysInMonth } from '../../../shared/social-insurance/monthly/social-insurance-data.util';
import type {
  RetroactiveRemunerationProposedGrades,
  RetroactiveRemunerationReviewDocument,
} from '../../../shared/retroactive-remuneration-review-document';
import {
  getMonthlyDocument,
  saveStandardRemuneration,
  type StandardRemunerationSavePayload,
} from './repos';
import {
  computeTeijiBonusRelatedRemuneration,
} from './teiji-bonus-remuneration';
import { teijiAnnualAverageReviewId } from './remuneration-review-ids';

function consentCollectionRef(db: admin.firestore.Firestore, tid: string) {
  return db.collection('tenants').doc(tid).collection('remunerationConsentReviews');
}

function collectionRef(db: admin.firestore.Firestore, tid: string) {
  return db.collection('tenants').doc(tid).collection('retroactiveRemunerationReviews');
}

export function teijiRetroactiveReviewId(eid: string, teijiYear: number): string {
  return `retro_teiji_${eid}_${teijiYear}`;
}

export function teijiAnnualAverageRetroactiveReviewId(eid: string, teijiYear: number): string {
  return `retro_teiji_aa_${eid}_${teijiYear}`;
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

async function detectRetroactivePayInMonths(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  monthKeys: readonly string[],
): Promise<RetroactivePayDetectedItem[]> {
  const detected: RetroactivePayDetectedItem[] = [];
  for (const yyyyMm of monthKeys) {
    const monthly = await getMonthlyDocument(db, tid, eid, yyyyMm);
    const amount = monthly?.payrollData?.retroactivePay ?? 0;
    if (amount > 0) {
      detected.push({ paymentYyyyMm: yyyyMm, amount });
    }
  }
  return detected;
}

function gradesToProposed(
  grades: ResolvedStandardRemuneration,
  effectiveFrom: string,
): RetroactiveRemunerationProposedGrades {
  return {
    healthGrade: grades.health.grade,
    pensionGrade: grades.pension.grade,
    healthStandardRemuneration: grades.health.standardRemuneration,
    pensionStandardRemuneration: grades.pension.standardRemuneration,
    remuneration: grades.remuneration,
    effectiveFrom,
  };
}

function proposedToSavePayload(
  proposed: RetroactiveRemunerationProposedGrades,
  source: 'teiji',
  bonusRemunerationMonthlyAddition?: number,
): StandardRemunerationSavePayload {
  return {
    healthGrade: proposed.healthGrade,
    pensionGrade: proposed.pensionGrade,
    standardRemuneration: {
      health: proposed.healthStandardRemuneration,
      pension: proposed.pensionStandardRemuneration,
    },
    source,
    effectiveFrom: proposed.effectiveFrom,
    remuneration: proposed.remuneration,
    bonusRemunerationMonthlyAddition,
  };
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

async function notifyAdminRetroactiveReview(
  db: admin.firestore.Firestore,
  tid: string,
  input: {
    reviewId: string;
    title: string;
    body: string;
    targetEid: string;
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
      type: 'retroactiveRemunerationReview',
      title: input.title,
      body: input.body,
      reviewId: input.reviewId,
      targetEid: input.targetEid,
      dedupeKey: `retroactive_${input.reviewId}`,
      status: 'pending_review',
      read: false,
      tid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function ensureRetroactiveReview(
  db: admin.firestore.Firestore,
  tid: string,
  reviewId: string,
  data: Omit<
    RetroactiveRemunerationReviewDocument,
    'createdAt' | 'updatedAt' | 'status' | 'reviewedByUid' | 'reviewedAt' | 'proposedGrades' | 'items'
  > & {
    items: readonly RetroactivePayDetectedItem[];
    proposedGrades?: RetroactiveRemunerationProposedGrades;
  },
  notification: { title: string; body: string },
): Promise<{ created: boolean }> {
  const ref = collectionRef(db, tid).doc(reviewId);
  const existing = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  let created = false;

  if (!existing.exists) {
    const items = data.items.map((item) => defaultRetroactiveReviewItem(item));
    await ref.set({
      ...data,
      items,
      status: 'pending_admin',
      createdAt: now,
      updatedAt: now,
    });
    created = true;
  } else {
    await ref.set({ updatedAt: now }, { merge: true });
  }

  await notifyAdminRetroactiveReview(db, tid, {
    reviewId,
    title: notification.title,
    body: notification.body,
    targetEid: data.eid,
  });

  return { created };
}

export async function ensureTeijiRetroactiveReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  screeningYyyyMm: string,
  employeeDisplayName: string,
  originalGrades: RetroactiveRemunerationProposedGrades,
): Promise<void> {
  const windowMonthKeys = [`${teijiYear}-04`, `${teijiYear}-05`, `${teijiYear}-06`];
  const detected = await detectRetroactivePayInMonths(db, tid, eid, windowMonthKeys);
  if (detected.length === 0) return;

  const reviewId = teijiRetroactiveReviewId(eid, teijiYear);
  const totalAmount = detected.reduce((s, d) => s + d.amount, 0);
  await ensureRetroactiveReview(
    db,
    tid,
    reviewId,
    {
      type: 'teiji',
      eid,
      employeeDisplayName,
      teijiYear,
      screeningYyyyMm,
      windowMonthKeys,
      calculationMonthKeys: windowMonthKeys,
      items: detected,
      originalGrades,
    },
    {
      title: `【遡及支払・定時決定】${employeeDisplayName}様`,
      body:
        `定時決定対象期間（4〜6月）に遡及支払が${detected.length}件（合計${totalAmount}円）あります。` +
        'タスクボードの「遡及支払の配分・再計算」で、対象期間に該当する金額と賃金区分（対象月ごと）を設定してください。全額の配分は不要です。',
    },
  );
}

export async function ensureTeijiAnnualAverageRetroactiveReview(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  screeningYyyyMm: string,
  employeeDisplayName: string,
  teijiHealthGrade: number,
  teijiPensionGrade: number,
  proposedAnnualGrades: RetroactiveRemunerationProposedGrades,
): Promise<void> {
  const periodKeys = buildAnnualAveragePeriodMonthKeys(`${teijiYear}-07`);
  const detected = await detectRetroactivePayInMonths(db, tid, eid, periodKeys);
  if (detected.length === 0) return;

  const reviewId = teijiAnnualAverageRetroactiveReviewId(eid, teijiYear);
  const consentReviewId = teijiAnnualAverageReviewId(eid, teijiYear);
  const totalAmount = detected.reduce((s, d) => s + d.amount, 0);
  await ensureRetroactiveReview(
    db,
    tid,
    reviewId,
    {
      type: 'teiji_annual_average',
      eid,
      employeeDisplayName,
      teijiYear,
      screeningYyyyMm,
      windowMonthKeys: periodKeys,
      calculationMonthKeys: periodKeys,
      items: detected,
      originalGrades: {
        healthGrade: teijiHealthGrade,
        pensionGrade: teijiPensionGrade,
        healthStandardRemuneration: 0,
        pensionStandardRemuneration: 0,
        remuneration: 0,
        effectiveFrom: `${teijiYear}-09`,
      },
      linkedConsentReviewId: consentReviewId,
    },
    {
      title: `【遡及支払・年間平均】${employeeDisplayName}様`,
      body:
        `年間平均算定期間に遡及支払が${detected.length}件（合計${totalAmount}円）あります。` +
        '配分・再計算後、年間平均候補の等級が更新されます。',
    },
  );

  const ref = collectionRef(db, tid).doc(reviewId);
  await ref.set({ proposedGrades: proposedAnnualGrades }, { merge: true });
}

async function loadMonthSources(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  monthKeys: readonly string[],
): Promise<MonthlyRemunerationSource[]> {
  const sources: MonthlyRemunerationSource[] = [];
  for (const ym of monthKeys) {
    const source = await loadMonthlyRemunerationSource(db, tid, eid, ym);
    if (source) sources.push(source);
  }
  return sources;
}

async function recalcTeijiWithRetroactive(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
  calculationMonthKeys: readonly string[],
  items: readonly RetroactivePayReviewItem[],
): Promise<RetroactiveRemunerationProposedGrades> {
  const sources = await loadMonthSources(db, tid, eid, calculationMonthKeys);
  if (sources.length === 0) {
    throw new HttpsError('failed-precondition', '定時決定用の報酬データがありません。');
  }

  const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
  let teijiSources = applyRetroactiveToMonthlySources(sources, items);
  if (teijiBonus.qualifies) {
    teijiSources = withBonusRelatedRemuneration(teijiSources, teijiBonus.addition);
  }

  const outcome = determineTeiji(employmentType, teijiSources);
  if (outcome.kind === 'invalid') {
    throw new HttpsError('failed-precondition', '遡及配分後の定時決定が算出できません。');
  }

  if (outcome.kind === 'continue_previous') {
    throw new HttpsError(
      'failed-precondition',
      '遡及配分後も支払基礎日数不足のため等級を確定できません。配分を見直してください。',
    );
  }

  return gradesToProposed(outcome.grades, `${teijiYear}-09`);
}

async function recalcTeijiAnnualAverageWithRetroactive(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor',
  teijiHealthGrade: number,
  teijiPensionGrade: number,
  calculationMonthKeys: readonly string[],
  items: readonly RetroactivePayReviewItem[],
): Promise<RetroactiveRemunerationProposedGrades> {
  const sources = await loadMonthSources(db, tid, eid, calculationMonthKeys);
  const inputs = toAnnualAverageMonthInputs(sources);
  const adjusted = applyRetroactiveToAnnualInputs(inputs, items);

  const screening = screenAnnualAverageCandidate(
    employmentType,
    { teijiHealthGrade, teijiPensionGrade },
    adjusted,
  );
  if (screening.kind !== 'candidate') {
    throw new HttpsError(
      'failed-precondition',
      '遡及配分後は年間平均算定の候補条件を満たしません。配分を見直してください。',
    );
  }

  return gradesToProposed(screening.annualAverage.grades, `${teijiYear}-09`);
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

async function getEmployeeEmploymentType(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
): Promise<'full-time' | 'short-time-worker' | 'short-time-labor'> {
  const snap = await db.collection('tenants').doc(tid).collection('employees').doc(eid).get();
  const type = snap.data()?.employeeEmployInfo?.employmentType;
  return resolveEmploymentType(type);
}

interface RetroactiveActionInput {
  tid: string;
  reviewId: string;
  items?: RetroactivePayReviewItem[];
}

export const previewRetroactiveRemunerationRecalc = onCall<RetroactiveActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    const items = request.data?.items;
    if (!tid || !reviewId || !items?.length) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const validationError = validateRetroactiveReviewItems(normalizeRetroactiveReviewItems(items));
    if (validationError) {
      throw new HttpsError('invalid-argument', validationError);
    }
    const normalizedItems = normalizeRetroactiveReviewItems(items);

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const snap = await collectionRef(db, tid).doc(reviewId).get();
    if (!snap.exists) throw new HttpsError('not-found', '遡及支払レビューが見つかりません。');

    const review = snap.data() as RetroactiveRemunerationReviewDocument;
    if (review.status !== 'pending_admin') {
      throw new HttpsError('failed-precondition', '処理済みです。');
    }

    const employmentType = await getEmployeeEmploymentType(db, tid, review.eid);
    let proposedGrades: RetroactiveRemunerationProposedGrades;

    if (review.type === 'teiji') {
      proposedGrades = await recalcTeijiWithRetroactive(
        db,
        tid,
        review.eid,
        review.teijiYear,
        employmentType,
        review.calculationMonthKeys,
        normalizedItems,
      );
    } else {
      const teijiHealth = review.originalGrades?.healthGrade ?? 0;
      const teijiPension = review.originalGrades?.pensionGrade ?? 0;
      proposedGrades = await recalcTeijiAnnualAverageWithRetroactive(
        db,
        tid,
        review.eid,
        review.teijiYear,
        employmentType,
        teijiHealth,
        teijiPension,
        review.calculationMonthKeys,
        normalizedItems,
      );
    }

    return { proposedGrades, originalGrades: review.originalGrades ?? null };
  },
);

export const applyRetroactiveRemunerationRecalc = onCall<RetroactiveActionInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    const items = request.data?.items;
    if (!tid || !reviewId || !items?.length) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const validationError = validateRetroactiveReviewItems(normalizeRetroactiveReviewItems(items));
    if (validationError) {
      throw new HttpsError('invalid-argument', validationError);
    }
    const normalizedItems = normalizeRetroactiveReviewItems(items);

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = collectionRef(db, tid).doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', '遡及支払レビューが見つかりません。');

    const review = snap.data() as RetroactiveRemunerationReviewDocument;
    if (review.status !== 'pending_admin') {
      throw new HttpsError('failed-precondition', '処理済みです。');
    }

    const employmentType = await getEmployeeEmploymentType(db, tid, review.eid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    let proposedGrades: RetroactiveRemunerationProposedGrades;

    if (review.type === 'teiji') {
      proposedGrades = await recalcTeijiWithRetroactive(
        db,
        tid,
        review.eid,
        review.teijiYear,
        employmentType,
        review.calculationMonthKeys,
        normalizedItems,
      );

      const teijiBonus = await computeTeijiBonusRelatedRemuneration(
        db,
        tid,
        review.eid,
        review.teijiYear,
      );
      const payload = proposedToSavePayload(
        proposedGrades,
        'teiji',
        teijiBonus.qualifies && teijiBonus.addition > 0 ? teijiBonus.addition : undefined,
      );
      await saveStandardRemuneration(db, tid, review.eid, proposedGrades.effectiveFrom, payload);
    } else {
      const teijiHealth = review.originalGrades?.healthGrade ?? 0;
      const teijiPension = review.originalGrades?.pensionGrade ?? 0;
      proposedGrades = await recalcTeijiAnnualAverageWithRetroactive(
        db,
        tid,
        review.eid,
        review.teijiYear,
        employmentType,
        teijiHealth,
        teijiPension,
        review.calculationMonthKeys,
        normalizedItems,
      );

      if (review.linkedConsentReviewId) {
        const consentRef = consentCollectionRef(db, tid).doc(review.linkedConsentReviewId);
        const consentSnap = await consentRef.get();
        if (consentSnap.exists) {
          const consent = consentSnap.data() as { status?: string };
          if (
            consent.status === 'pending_employee_consent' ||
            consent.status === 'pending_admin_review'
          ) {
            const summaryBody =
              `定時決定等級 ${teijiHealth}/${teijiPension} → ` +
              `年間平均等級 ${proposedGrades.healthGrade}/${proposedGrades.pensionGrade}（${proposedGrades.effectiveFrom}適用・遡及配分反映）`;
            await consentRef.set(
              {
                proposedHealthGrade: proposedGrades.healthGrade,
                proposedPensionGrade: proposedGrades.pensionGrade,
                proposedHealthStandardRemuneration: proposedGrades.healthStandardRemuneration,
                proposedPensionStandardRemuneration: proposedGrades.pensionStandardRemuneration,
                proposedRemuneration: proposedGrades.remuneration,
                summaryBody,
                updatedAt: now,
              },
              { merge: true },
            );
          }
        }
      }
    }

    await ref.set(
      {
        status: 'recalculated',
        items: normalizedItems,
        proposedGrades,
        reviewedByUid: uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return { status: 'recalculated', proposedGrades };
  },
);

export const skipRetroactiveRemunerationReview = onCall<{ tid: string; reviewId: string }>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');

    const tid = String(request.data?.tid ?? '').trim();
    const reviewId = String(request.data?.reviewId ?? '').trim();
    if (!tid || !reviewId) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, tid, uid);

    const ref = collectionRef(db, tid).doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', '遡及支払レビューが見つかりません。');

    const review = snap.data() as RetroactiveRemunerationReviewDocument;
    if (review.status !== 'pending_admin') {
      throw new HttpsError('failed-precondition', '処理済みです。');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(
      {
        status: 'skipped',
        reviewedByUid: uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    return { status: 'skipped' };
  },
);

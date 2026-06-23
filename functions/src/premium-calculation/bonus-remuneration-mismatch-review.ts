import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  bonusRemunerationMismatchReviewDocId,
  buildBonusRemunerationMismatchNotificationBody,
  buildBonusRemunerationMismatchNotificationTitle,
  hasBonusRelatedRemunerationMismatch,
} from '../../../shared/social-insurance/remuneration/bonus-remuneration-mismatch';
import { assertTenantAdmin } from '../core-functions';
import {
  computeTeijiBonusRelatedRemuneration,
  type TeijiBonusRelatedRemunerationResult,
} from './teiji-bonus-remuneration';

export type BonusRemunerationMismatchReviewStatus =
  | 'pending_review'
  | 'resolved_computed'
  | 'resolved_stored'
  | 'resolved_custom';

export interface BonusRemunerationMismatchReviewDocument {
  eid: string;
  teijiYear: number;
  screeningYyyyMm: string;
  determinationMonthKeys: string[];
  /** 標準報酬の適用開始月（定時決定: 9月、7〜9月適用随時改定: 7/8/9月） */
  applicationEffectiveFrom?: string;
  employeeDisplayName: string;
  storedBonusRelatedRemuneration: number;
  computedBonusRelatedRemuneration: number;
  /** applyChoice=custom のときの採択値 */
  customBonusRelatedRemuneration?: number;
  qualifies: boolean;
  status: BonusRemunerationMismatchReviewStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  resolvedAt?: admin.firestore.Timestamp;
  resolvedByUid?: string;
}

export interface TeijiPeriodBonusResolution {
  /** 不一致未解決のため定時決定・随時改定の判定を保留 */
  blocked: boolean;
  valueForCalculation: number;
  qualifies: boolean;
  valueToApply: number;
  applicationEffectiveFrom: string;
  determinationMonthKeys: string[];
}

export function resolveAdoptedBonusFromReview(
  data: BonusRemunerationMismatchReviewDocument,
): number | null {
  switch (data.status) {
    case 'resolved_computed':
      return data.computedBonusRelatedRemuneration;
    case 'resolved_stored':
      return data.storedBonusRelatedRemuneration;
    case 'resolved_custom':
      return data.customBonusRelatedRemuneration ?? null;
    default:
      return null;
  }
}

function reviewRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('bonusRemunerationMismatchReviews')
    .doc(bonusRemunerationMismatchReviewDocId(eid, teijiYear));
}

async function notifyTenantAdmins(
  db: admin.firestore.Firestore,
  tid: string,
  notifDoc: Record<string, unknown>,
): Promise<void> {
  const admins = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .where('role', '==', 'admin')
    .get();

  const now = admin.firestore.FieldValue.serverTimestamp();
  for (const adminDoc of admins.docs) {
    const uid = adminDoc.data()?.uid as string | undefined;
    if (!uid) continue;
    await db
      .collection('accounts')
      .doc(uid)
      .collection('notifications')
      .add({ ...notifDoc, createdAt: now });
  }
}

interface EnsureBonusMismatchReviewOptions {
  applicationEffectiveFrom?: string;
  determinationMonthKeys: string[];
  computedValue?: number;
  qualifies?: boolean;
}

export async function ensureBonusRemunerationMismatchReviewIfNeeded(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  yyyyMm: string,
  employeeDisplayName: string,
  storedBonusRelatedRemuneration: number,
  options: EnsureBonusMismatchReviewOptions,
): Promise<void> {
  try {
    const applicationEffectiveFrom =
      options.applicationEffectiveFrom ?? `${teijiYear}-09`;

    let computedValue = options.computedValue;
    let qualifies = options.qualifies;
    if (computedValue == null || qualifies == null) {
      const teijiBonus = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
      computedValue = teijiBonus.qualifies ? teijiBonus.addition : 0;
      qualifies = teijiBonus.qualifies;
    }

    const storedValue = storedBonusRelatedRemuneration;

    if (!hasBonusRelatedRemunerationMismatch(storedValue, computedValue)) {
      return;
    }

    const ref = reviewRef(db, tid, eid, teijiYear);
    const existing = await ref.get();
    if (existing.exists) {
      const data = existing.data() as BonusRemunerationMismatchReviewDocument;
      if (data.status !== 'pending_review') {
        return;
      }
      const now = admin.firestore.FieldValue.serverTimestamp();
      await ref.set(
        {
          screeningYyyyMm: yyyyMm,
          determinationMonthKeys: options.determinationMonthKeys,
          applicationEffectiveFrom,
          storedBonusRelatedRemuneration: storedValue,
          computedBonusRelatedRemuneration: computedValue,
          qualifies,
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }

    const displayName = employeeDisplayName || '対象従業員';
    const now = admin.firestore.FieldValue.serverTimestamp();
    const review: Omit<BonusRemunerationMismatchReviewDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: admin.firestore.FieldValue;
      updatedAt: admin.firestore.FieldValue;
    } = {
      eid,
      teijiYear,
      screeningYyyyMm: yyyyMm,
      determinationMonthKeys: [...options.determinationMonthKeys],
      applicationEffectiveFrom,
      employeeDisplayName: displayName,
      storedBonusRelatedRemuneration: storedValue,
      computedBonusRelatedRemuneration: computedValue,
      qualifies,
      status: 'pending_review',
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(review);

    await notifyTenantAdmins(db, tid, {
      scope: 'tenant',
      type: 'bonusRemunerationMismatch',
      title: buildBonusRemunerationMismatchNotificationTitle(displayName),
      body: buildBonusRemunerationMismatchNotificationBody(
        displayName,
        storedValue,
        computedValue,
        yyyyMm,
      ),
      targetEid: eid,
      teijiYear,
      screeningYyyyMm: yyyyMm,
      applicationEffectiveFrom,
      storedBonusRelatedRemuneration: storedValue,
      computedBonusRelatedRemuneration: computedValue,
      read: false,
      tid,
    });
  } catch (err) {
    console.error('[bonus-remuneration-mismatch] ensure failed', { tid, eid, yyyyMm, err });
  }
}

/**
 * 定時決定・7〜9月適用随時改定の判定前に呼ぶ。
 * 実績算定値で判定する。入力値と異なる場合はレビューを起票し判定を保留する。
 */
export async function resolveTeijiPeriodBonusRelatedRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  computed: TeijiBonusRelatedRemunerationResult,
  storedValue: number,
  options: {
    applicationEffectiveFrom: string;
    screeningYyyyMm: string;
    employeeDisplayName: string;
    determinationMonthKeys: readonly string[];
  },
): Promise<TeijiPeriodBonusResolution> {
  const computedValue = computed.qualifies ? computed.addition : 0;
  const {
    applicationEffectiveFrom,
    screeningYyyyMm,
    employeeDisplayName,
    determinationMonthKeys,
  } = options;

  const base = {
    qualifies: computed.qualifies,
    applicationEffectiveFrom,
    determinationMonthKeys: [...determinationMonthKeys],
  };

  if (!hasBonusRelatedRemunerationMismatch(storedValue, computedValue)) {
    return {
      ...base,
      blocked: false,
      valueForCalculation: computedValue,
      valueToApply: computedValue,
    };
  }

  const ref = reviewRef(db, tid, eid, teijiYear);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() as BonusRemunerationMismatchReviewDocument;
    if (data.status === 'resolved_computed') {
      return {
        ...base,
        blocked: false,
        valueForCalculation: computedValue,
        valueToApply: computedValue,
        determinationMonthKeys:
          data.determinationMonthKeys?.length > 0
            ? data.determinationMonthKeys
            : base.determinationMonthKeys,
      };
    }
    if (data.status === 'resolved_stored') {
      const stored = data.storedBonusRelatedRemuneration;
      return {
        ...base,
        blocked: false,
        valueForCalculation: stored,
        valueToApply: stored,
        applicationEffectiveFrom: data.applicationEffectiveFrom ?? applicationEffectiveFrom,
        determinationMonthKeys:
          data.determinationMonthKeys?.length > 0
            ? data.determinationMonthKeys
            : base.determinationMonthKeys,
      };
    }
    if (data.status === 'resolved_custom') {
      const custom = resolveAdoptedBonusFromReview(data);
      if (custom == null || !Number.isFinite(custom) || custom < 0) {
        return {
          ...base,
          blocked: true,
          valueForCalculation: computedValue,
          valueToApply: computedValue,
        };
      }
      return {
        ...base,
        blocked: false,
        valueForCalculation: custom,
        valueToApply: custom,
        applicationEffectiveFrom: data.applicationEffectiveFrom ?? applicationEffectiveFrom,
        determinationMonthKeys:
          data.determinationMonthKeys?.length > 0
            ? data.determinationMonthKeys
            : base.determinationMonthKeys,
      };
    }
  }

  await ensureBonusRemunerationMismatchReviewIfNeeded(
    db,
    tid,
    eid,
    teijiYear,
    screeningYyyyMm,
    employeeDisplayName,
    storedValue,
    {
      applicationEffectiveFrom,
      determinationMonthKeys: [...determinationMonthKeys],
      computedValue,
      qualifies: computed.qualifies,
    },
  );

  return {
    ...base,
    blocked: true,
    valueForCalculation: computedValue,
    valueToApply: computedValue,
  };
}

interface ResolveBonusRemunerationMismatchInput {
  tid: string;
  eid: string;
  teijiYear: number;
  applyChoice: 'computed' | 'stored' | 'custom';
  customBonusRelatedRemuneration?: number;
  recalculatePremium: boolean;
}

export const resolveBonusRemunerationMismatchReview = onCall<ResolveBonusRemunerationMismatchInput>(
  { region: 'asia-northeast1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const tid = String(request.data?.tid ?? '').trim();
    const eid = String(request.data?.eid ?? '').trim();
    const teijiYear = Number(request.data?.teijiYear);
    const applyChoice = request.data?.applyChoice;
    const customBonusRelatedRemuneration = Number(request.data?.customBonusRelatedRemuneration);
    const recalculatePremium = request.data?.recalculatePremium === true;

    if (!tid || !eid || !Number.isFinite(teijiYear) || teijiYear <= 0) {
      throw new HttpsError('invalid-argument', 'パラメータが不足しています。');
    }
    if (applyChoice !== 'computed' && applyChoice !== 'stored' && applyChoice !== 'custom') {
      throw new HttpsError('invalid-argument', '適用する値を指定してください。');
    }
    if (
      applyChoice === 'custom' &&
      (!Number.isFinite(customBonusRelatedRemuneration) || customBonusRelatedRemuneration < 0)
    ) {
      throw new HttpsError('invalid-argument', '任意の値を0以上の数値で指定してください。');
    }

    const db = admin.firestore();
    await assertTenantAdmin(db, uid, tid);

    const ref = reviewRef(db, tid, eid, teijiYear);
    const reviewSnap = await ref.get();
    if (!reviewSnap.exists) {
      throw new HttpsError('not-found', '確認依頼が見つかりません。');
    }
    const review = reviewSnap.data() as BonusRemunerationMismatchReviewDocument;
    if (review.status !== 'pending_review') {
      throw new HttpsError('failed-precondition', 'この確認依頼は処理済みです。');
    }

    const status: BonusRemunerationMismatchReviewStatus =
      applyChoice === 'computed'
        ? 'resolved_computed'
        : applyChoice === 'stored'
          ? 'resolved_stored'
          : 'resolved_custom';

    await ref.set(
      {
        status,
        ...(applyChoice === 'custom'
          ? { customBonusRelatedRemuneration: Math.floor(customBonusRelatedRemuneration) }
          : {}),
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    let recalculated = false;
    if (recalculatePremium) {
      const { calculateMonthlyEmployee } = await import('./calculate-monthly-employee.js');
      await calculateMonthlyEmployee(db, tid, eid, review.screeningYyyyMm);
      recalculated = true;
    }

    return { status, recalculated, recalculatedYyyyMm: review.screeningYyyyMm };
  },
);

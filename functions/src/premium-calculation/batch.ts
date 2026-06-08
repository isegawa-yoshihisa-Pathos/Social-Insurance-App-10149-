import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFunctions } from 'firebase-admin/functions';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { assertTenantAdmin, mapCoreErrorToHttpsError } from '../core-functions';
import {
  assertValidYyyyMm,
  CalculatePremiumTaskPayload,
  resolveTargetEids,
  StartPremiumCalculationBatchInput,
} from './core';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MAX_BATCH_SIZE = 500;
const FIRESTORE_BATCH_LIMIT = 400;

export const startPremiumCalculationBatch = onCall<StartPremiumCalculationBatchInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, kind, yyyyMm, eids } = request.data ?? {};
    if (!tid || !kind || !yyyyMm) {
      throw new HttpsError('invalid-argument', 'tid, kind, yyyyMm は必須です。');
    }
    if (kind !== 'monthly' && kind !== 'bonus') {
      throw new HttpsError('invalid-argument', 'kind は monthly または bonus です。');
    }

    try {
      assertValidYyyyMm(yyyyMm);
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const db = admin.firestore();

    try {
      await assertTenantAdmin(db, uid, tid);
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const targetEids = await resolveTargetEids(db, tid, kind, yyyyMm, eids);
    if (targetEids.length === 0) {
      throw new HttpsError('invalid-argument', '計算対象の従業員がありません。');
    }
    if (targetEids.length > MAX_BATCH_SIZE) {
      throw new HttpsError(
        'invalid-argument',
        `一度に計算できるのは ${MAX_BATCH_SIZE} 件までです。`,
      );
    }

    const jobId = randomUUID();
    const jobRef = db
      .collection('tenants')
      .doc(tid)
      .collection('premiumCalculationJobs')
      .doc(jobId);

    const now = admin.firestore.FieldValue.serverTimestamp();

    await jobRef.set({
      status: 'running',
      kind,
      yyyyMm,
      total: targetEids.length,
      succeeded: 0,
      failed: 0,
      notificationSent: false,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < targetEids.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = targetEids.slice(i, i + FIRESTORE_BATCH_LIMIT);
      const batch = db.batch();

      for (const eid of chunk) {
        const itemRef = jobRef.collection('items').doc(eid);
        batch.set(itemRef, {
          status: 'queued',
          jobResultRecorded: false,
          createdAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();
    }

    const queue = getFunctions().taskQueue(
      'locations/asia-northeast1/functions/calculatePremiumTask',
    );

    const taskPayloads: CalculatePremiumTaskPayload[] = targetEids.map((eid) => ({
      tid,
      jobId,
      eid,
      kind,
      yyyyMm,
      createdBy: uid,
    }));

    try {
      await Promise.all(
        taskPayloads.map((payload) =>
          queue.enqueue(payload, {
            id: `${jobId}_${payload.eid}`,
            dispatchDeadlineSeconds: 60 * 5,
          }),
        ),
      );
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      await jobRef.update({
        status: 'failed',
        errorMessage: rawMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new HttpsError('internal', '保険料計算タスクの登録に失敗しました。');
    }

    return { jobId, total: targetEids.length };
  },
);
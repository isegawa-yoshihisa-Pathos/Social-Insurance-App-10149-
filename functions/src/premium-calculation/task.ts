import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import * as admin from 'firebase-admin';
import { calculateMonthlyEmployee } from './calculate-monthly-employee';
import { calculateBonusEmployee } from './calculate-bonus-employee';
import { CalculatePremiumTaskPayload } from './core';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const calculatePremiumTask = onTaskDispatched<CalculatePremiumTaskPayload>(
  {
    region: 'asia-northeast1',
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 30,
    },
    rateLimits: {
      maxConcurrentDispatches: 5,
    },
    timeoutSeconds: 300,
  },
  async (req) => {
    const { tid, jobId, eid, kind, yyyyMm, createdBy } = req.data;
    const db = admin.firestore();

    const itemRef = db
      .collection('tenants')
      .doc(tid)
      .collection('premiumCalculationJobs')
      .doc(jobId)
      .collection('items')
      .doc(eid);

    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      console.error('premium calculation item not found', { tid, jobId, eid });
      await recordTaskResult(db, tid, jobId, eid, false, createdBy, kind, yyyyMm);
      return;
    }

    const current = itemSnap.data();
    if (current?.jobResultRecorded === true || current?.status === 'succeeded') {
      return;
    }

    await itemRef.update({
      status: 'running',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let succeeded = false;
    try {
      if (kind === 'monthly') {
        await calculateMonthlyEmployee(db, tid, eid, yyyyMm);
      } else {
        await calculateBonusEmployee(db, tid, eid, yyyyMm);
      }

      await itemRef.update({
        status: 'succeeded',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      succeeded = true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '保険料計算に失敗しました。';

      await itemRef.update({
        status: 'failed',
        errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      succeeded = false;
      throw error;
    } finally {
      await recordTaskResult(db, tid, jobId, eid, succeeded, createdBy, kind, yyyyMm);
    }
  },
);

async function recordTaskResult(
  db: admin.firestore.Firestore,
  tid: string,
  jobId: string,
  eid: string,
  succeeded: boolean,
  createdBy: string,
  kind: CalculatePremiumTaskPayload['kind'],
  yyyyMm: string,
): Promise<void> {
  const jobRef = db
    .collection('tenants')
    .doc(tid)
    .collection('premiumCalculationJobs')
    .doc(jobId);
  const itemRef = jobRef.collection('items').doc(eid);

  await db.runTransaction(async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (itemSnap.exists && itemSnap.data()?.jobResultRecorded === true) {
      return;
    }

    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) return;

    const job = jobSnap.data()!;
    const total = Number(job.total ?? 0);
    const nextSucceeded = Number(job.succeeded ?? 0) + (succeeded ? 1 : 0);
    const nextFailed = Number(job.failed ?? 0) + (succeeded ? 0 : 1);

    if (itemSnap.exists) {
      tx.update(itemRef, {
        jobResultRecorded: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(jobRef, {
      succeeded: nextSucceeded,
      failed: nextFailed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const done = nextSucceeded + nextFailed >= total;
    if (!done || job.notificationSent === true) {
      return;
    }

    const admins = await db.collection('tenants').doc(tid).collection('employees').where('role', '==', 'admin').get();
    const adminUids = admins.docs.map((doc) => doc.data()?.uid);

    const label = kind === 'monthly' ? '月次' : '賞与';

    const notifDoc = {
      scope: 'tenant',
      type: 'premium_calculation_completed',
      jobId,
      title: `${label}保険料計算が完了しました`,
      body: `${yyyyMm} / ${total}件中 ${nextSucceeded}件成功、${nextFailed}件失敗`,
      totals: {
        total,
        succeeded: nextSucceeded,
        failed: nextFailed,
      },
      read: false,
      createdBy: job.createdBy ?? createdBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    for (const uid of adminUids) {
      const notifRef = db.collection('accounts').doc(uid).collection('notifications').doc();
      tx.set(notifRef, notifDoc);
    }

    tx.update(jobRef, {
      status: 'completed',
      notificationSent: true,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}
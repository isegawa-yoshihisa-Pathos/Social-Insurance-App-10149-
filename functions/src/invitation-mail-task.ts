import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import * as admin from 'firebase-admin';
import {
  buildInviteLink,
  loadInvitationMailContext,
  sendVirtualInvitationMail,
} from './invitation-mail-core';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface DeliverInvitationTaskPayload {
  tid: string;
  jobId: string;
  inviteId: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  rawToken: string;
  invitedBy: string;
}

export const deliverInvitationMailTask = onTaskDispatched<DeliverInvitationTaskPayload>(
  {
    region: 'asia-northeast1',
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 30,
    },
    rateLimits: {
      maxConcurrentDispatches: 6,
    },
    timeoutSeconds: 300,
  },
  async (req) => {
    const { tid, jobId, inviteId, email, name, rawToken, invitedBy } = req.data;
    const db = admin.firestore();

    const inviteRef = db
      .collection('tenants')
      .doc(tid)
      .collection('invitations')
      .doc(inviteId);

    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      console.error('invite not found', { tid, inviteId, jobId });
      await recordTaskResult(db, tid, jobId, inviteId, false, invitedBy);
      return;
    }

    const current = inviteSnap.data();
    if (current?.jobResultRecorded === true || current?.status === 'sent') {
      return;
    }

    await inviteRef.update({
      status: 'sending',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    let succeeded = false;
    try {
      const ctx = await loadInvitationMailContext(db, tid);
      const inviteLink = buildInviteLink(ctx.frontendUrl, rawToken);
      const { messageId } = await sendVirtualInvitationMail({
        tid,
        email,
        name,
        inviteLink,
        ctx,
      });

      await inviteRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        resendMessageId: messageId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      succeeded = true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'メール送信に失敗しました。';

      await inviteRef.update({
        status: 'failed',
        errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      succeeded = false;
      throw error;
    } finally {
      await recordTaskResult(db, tid, jobId, inviteId, succeeded, invitedBy);
    }
  },
);

async function recordTaskResult(
  db: admin.firestore.Firestore,
  tid: string,
  jobId: string,
  inviteId: string,
  succeeded: boolean,
  createdBy: string,
): Promise<void> {
  const jobRef = db
    .collection('tenants')
    .doc(tid)
    .collection('invitationJobs')
    .doc(jobId);
  const inviteRef = db
    .collection('tenants')
    .doc(tid)
    .collection('invitations')
    .doc(inviteId);

  await db.runTransaction(async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (inviteSnap.exists && inviteSnap.data()?.jobResultRecorded === true) {
      return;
    }

    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) return;

    const job = jobSnap.data()!;
    const total = Number(job.total ?? 0);
    const nextSucceeded = Number(job.succeeded ?? 0) + (succeeded ? 1 : 0);
    const nextFailed = Number(job.failed ?? 0) + (succeeded ? 0 : 1);

    if (inviteSnap.exists) {
      tx.update(inviteRef, {
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

    const notifDoc = {
      scope: 'tenant',
      type: 'invitation_batch_completed',
      jobId,
      title: '招待メール送信が完了しました',
      body: `${total}件中 ${nextSucceeded}件成功、${nextFailed}件失敗`,
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
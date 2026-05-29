import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFunctions } from 'firebase-admin/functions';
import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import {
  assertTenantAdmin,
  createInvitationToken,
  isValidEmail,
  loadInvitationMailContext,
  mapCoreErrorToHttpsError,
} from './invitation-mail-core';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const MAX_BATCH_SIZE = 100;

interface BatchItem {
  email: string;
  name: string;
  role: 'admin' | 'member';
}

interface StartBatchInput {
  tid: string;
  items: BatchItem[];
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

export const startInvitationMailBatch = onCall<StartBatchInput>(
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

    const { tid, items } = request.data;
    if (!tid || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError('invalid-argument', '送信対象がありません。');
    }
    if (items.length > MAX_BATCH_SIZE) {
      throw new HttpsError(
        'invalid-argument',
        `一度に送信できるのは ${MAX_BATCH_SIZE} 件までです。`,
      );
    }

    const normalized = normalizeItems(items);
    if (normalized.length === 0) {
      throw new HttpsError('invalid-argument', '有効な送信対象がありません。');
    }

    const db = admin.firestore();

    try {
      await assertTenantAdmin(db, uid, tid);
      await loadInvitationMailContext(db, tid); // 事前検証
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const jobId = randomUUID();
    const jobRef = db
      .collection('tenants')
      .doc(tid)
      .collection('invitationJobs')
      .doc(jobId);

    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const queue = getFunctions().taskQueue(
      'locations/asia-northeast1/functions/deliverInvitationMailTask',
    );
    const batch = db.batch();
    const taskPayloads: DeliverInvitationTaskPayload[] = [];

    for (const item of normalized) {
      const inviteRef = db
        .collection('tenants')
        .doc(tid)
        .collection('invitations')
        .doc();

      const { rawToken, tokenHash } = createInvitationToken();

      batch.set(inviteRef, {
        contactEmail: item.email,
        name: item.name,
        tokenHash,
        status: 'queued',
        role: item.role,
        jobId,
        invitedBy: uid,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      taskPayloads.push({
        tid,
        jobId,
        inviteId: inviteRef.id,
        email: item.email,
        name: item.name,
        role: item.role,
        rawToken,
        invitedBy: uid,
      });
    }

    batch.set(jobRef, {
      status: 'running',
      total: normalized.length,
      succeeded: 0,
      failed: 0,
      notificationSent: false,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    try {
      await Promise.all(
        taskPayloads.map((payload) =>
          queue.enqueue(payload, {
            id: `${jobId}_${payload.inviteId}`,
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
    }

    return { jobId, total: normalized.length };
  },
);

function normalizeItems(items: BatchItem[]): BatchItem[] {
  const map = new Map<string, BatchItem>();
  for (const raw of items) {
    const email = raw.email?.trim() ?? '';
    const name = raw.name?.trim() ?? '';
    const role = raw.role;
    if (!name || !isValidEmail(email)) continue;
    if (role !== 'admin' && role !== 'member') continue;
    map.set(email.toLowerCase(), { email, name, role });
  }
  return Array.from(map.values());
}
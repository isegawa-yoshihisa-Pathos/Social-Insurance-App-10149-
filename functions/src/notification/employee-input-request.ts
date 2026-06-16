import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertTenantAdmin, mapCoreErrorToHttpsError } from '../core-functions';
import {
  buildEmployeeInputRequestNotificationBody,
  buildEmployeeInputRequestNotificationTitle,
  type EmployeeInputRequestField,
} from '../../../shared/employee-input-request';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const VALID_FIELDS = new Set<EmployeeInputRequestField>([
  'myNumber',
  'basicPensionNumber',
  'birthDate',
  'hasDependents',
]);

export interface RequestEmployeeInputInput {
  tid: string;
  eids: string[];
  field: EmployeeInputRequestField;
}

export interface RequestEmployeeInputResult {
  notified: number;
  skippedNoAccount: number;
  skippedNotFound: number;
}

export const requestEmployeeInput = onCall<RequestEmployeeInputInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, eids, field } = request.data ?? {};
    if (!tid || !field || !Array.isArray(eids) || eids.length === 0) {
      throw new HttpsError('invalid-argument', 'tid, eids, field は必須です。');
    }
    if (!VALID_FIELDS.has(field)) {
      throw new HttpsError('invalid-argument', '依頼対象の項目が不正です。');
    }
    if (eids.length > 500) {
      throw new HttpsError('invalid-argument', '一度に依頼できるのは500件までです。');
    }

    const db = admin.firestore();
    try {
      await assertTenantAdmin(db, uid, tid);
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const uniqueEids = [...new Set(eids.filter((eid) => typeof eid === 'string' && eid.trim()))];
    const now = admin.firestore.FieldValue.serverTimestamp();
    const title = buildEmployeeInputRequestNotificationTitle(field);
    const body = buildEmployeeInputRequestNotificationBody(field);

    let notified = 0;
    let skippedNoAccount = 0;
    let skippedNotFound = 0;

    for (const eid of uniqueEids) {
      const employeeSnap = await db
        .collection('tenants')
        .doc(tid)
        .collection('employees')
        .doc(eid)
        .get();

      if (!employeeSnap.exists) {
        skippedNotFound += 1;
        continue;
      }

      const employee = employeeSnap.data()!;
      const employeeUid = employee.uid as string | undefined;
      if (!employeeUid) {
        skippedNoAccount += 1;
        continue;
      }

      await db.collection('accounts').doc(employeeUid).collection('notifications').add({
        scope: 'personal',
        type: 'employeeInputRequest',
        title,
        body,
        field,
        tid,
        targetEid: eid,
        requestedByUid: uid,
        read: false,
        createdAt: now,
      });
      notified += 1;
    }

    if (notified === 0 && skippedNoAccount === 0 && skippedNotFound === uniqueEids.length) {
      throw new HttpsError('not-found', '対象の従業員が見つかりません。');
    }

    return {
      notified,
      skippedNoAccount,
      skippedNotFound,
    } satisfies RequestEmployeeInputResult;
  },
);

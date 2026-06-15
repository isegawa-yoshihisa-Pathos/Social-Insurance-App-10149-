import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertTenantAdmin, mapCoreErrorToHttpsError } from '../core-functions';
import { toFormDate } from '../../../shared/date-utils';
import { lastPremiumMonthYyyyMm } from '../../../shared/social-insurance/premium/insurance-period';
import { getEmployee, getTenant } from './repos';
import { calculateMonthlyEmployee } from './calculate-monthly-employee';
import {
  clearPremiumFieldsAfterResign,
  listEmployeeMonthlyRecords,
  updateResignBulkPremiumForEmployee,
} from './resign-bulk-premium';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export interface RecalculatePremiumsAfterResignInput {
  tid: string;
  eid: string;
}

export const recalculatePremiumsAfterResign = onCall<RecalculatePremiumsAfterResignInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    timeoutSeconds: 300,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, eid } = request.data ?? {};
    if (!tid || !eid) {
      throw new HttpsError('invalid-argument', 'tid, eid は必須です。');
    }

    const db = admin.firestore();

    try {
      await assertTenantAdmin(db, uid, tid);
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const [employee, tenant] = await Promise.all([
      getEmployee(db, tid, eid),
      getTenant(db, tid),
    ]);

    const licenseEndAt = toFormDate(employee.employeeEmployInfo?.licenseEndAt);
    if (!licenseEndAt) {
      throw new HttpsError(
        'failed-precondition',
        '資格喪失日が未設定のため保険料を再計算できません。',
      );
    }

    await clearPremiumFieldsAfterResign(db, tid, eid, licenseEndAt);

    const lastPremium = lastPremiumMonthYyyyMm(licenseEndAt);
    const records = await listEmployeeMonthlyRecords(db, tid, eid);
    const recalcTargets = records
      .filter(({ yyyyMm, doc }) => yyyyMm <= lastPremium && doc.payrollData)
      .map(({ yyyyMm }) => yyyyMm)
      .sort();

    for (const yyyyMm of recalcTargets) {
      try {
        await calculateMonthlyEmployee(db, tid, eid, yyyyMm);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[recalculate-after-resign] monthly calc skipped', {
          tid,
          eid,
          yyyyMm,
          message,
        });
      }
    }

    await updateResignBulkPremiumForEmployee(db, tid, eid, employee, tenant);

    return { status: 'ok', recalculatedMonths: recalcTargets.length };
  },
);

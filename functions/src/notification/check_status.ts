import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { getCalendarDateInTimeZone, JAPAN_TIME_ZONE } from '../../../shared/date-utils';
import { resolveEmploymentStatusAsOf } from '../../../shared/employment-status';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const BATCH_LIMIT = 400;

export const updateEmployeeStatusesDaily = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
  },
  async () => {
    const db = admin.firestore();
    const asOf = getCalendarDateInTimeZone(JAPAN_TIME_ZONE);

    try {
      const tenantsSnapshot = await db.collection('tenants').get();

      for (const tenantDoc of tenantsSnapshot.docs) {
        await updateTenantEmployeeStatuses(db, tenantDoc.id, asOf);
      }
    } catch (error) {
      console.error('従業員ステータス更新のバッチ処理中にエラーが発生しました:', error);
    }
  },
);

async function updateTenantEmployeeStatuses(
  db: admin.firestore.Firestore,
  tid: string,
  asOf: Date,
): Promise<void> {
  const [employeesSnapshot, affiliationsSnapshot] = await Promise.all([
    db.collection('tenants').doc(tid).collection('employees').get(),
    db.collection('affiliations').where('tid', '==', tid).get(),
  ]);

  const affiliationRefs = new Map(
    affiliationsSnapshot.docs.map((docSnap) => [docSnap.id, docSnap.ref]),
  );

  let batch = db.batch();
  let batchCount = 0;

  for (const employeeDoc of employeesSnapshot.docs) {
    const employeeData = employeeDoc.data() as EmployeeDocument;
    const currentStatus = employeeData.employeeEmployInfo?.status ?? 'active';
    const nextStatus = resolveEmploymentStatusAsOf(employeeData, asOf);

    if (currentStatus === nextStatus) {
      continue;
    }

    batch.update(employeeDoc.ref, {
      'employeeEmployInfo.status': nextStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchCount += 1;

    const uid = employeeData.uid?.trim();
    if (uid) {
      const affiliationRef = affiliationRefs.get(`${uid}_${tid}`);
      if (affiliationRef) {
        batch.update(affiliationRef, {
          status: nextStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount += 1;
      }
    }

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }
}

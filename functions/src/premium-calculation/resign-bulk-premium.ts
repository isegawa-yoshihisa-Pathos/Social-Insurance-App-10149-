import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import { shouldClearPremiumForMonth } from '../../../shared/social-insurance/premium/resign-premium-collection';

export async function listEmployeeMonthlyRecords(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
): Promise<{ yyyyMm: string; doc: MonthlyDocument }[]> {
  const periodsSnap = await db
    .collection('tenants')
    .doc(tid)
    .collection('monthly-records')
    .get();

  const records: { yyyyMm: string; doc: MonthlyDocument }[] = [];
  for (const periodDoc of periodsSnap.docs) {
    const employeeSnap = await periodDoc.ref.collection('employees').doc(eid).get();
    if (!employeeSnap.exists) {
      continue;
    }
    records.push({
      yyyyMm: periodDoc.id,
      doc: employeeSnap.data() as MonthlyDocument,
    });
  }
  records.sort((a, b) => a.yyyyMm.localeCompare(b.yyyyMm));
  return records;
}

export async function clearPremiumFieldsAfterResign(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  licenseEndAt: Date,
  resignAt?: Date | null,
): Promise<void> {
  const records = await listEmployeeMonthlyRecords(db, tid, eid);
  const batch = db.batch();
  let hasUpdates = false;

  for (const { yyyyMm, doc } of records) {
    if (!shouldClearPremiumForMonth(licenseEndAt, yyyyMm, resignAt)) {
      continue;
    }
    if (!doc.premiumData && !doc.calculationSnapshot) {
      continue;
    }

    const ref = db
      .collection('tenants')
      .doc(tid)
      .collection('monthly-records')
      .doc(yyyyMm)
      .collection('employees')
      .doc(eid);

    batch.update(ref, {
      premiumData: admin.firestore.FieldValue.delete(),
      calculationSnapshot: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    hasUpdates = true;
  }

  if (hasUpdates) {
    await batch.commit();
  }
}

import * as admin from 'firebase-admin';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { toFormDate } from '../../../shared/date-utils';
import {
  computeResignBulkPremiumData,
  shouldClearPremiumForMonth,
  type ResignPremiumCollectionType,
  type SocialInsuranceCollectionMonth,
} from '../../../shared/social-insurance/premium/resign-premium-collection';
import { resignPayMonthYyyyMm } from '../../../shared/social-insurance/premium/insurance-period';
import { getEmployee, getTenant, type TenantDocumentForCalculation } from './repos';

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

function resolveTenantPremiumSettings(tenant: TenantDocumentForCalculation | null): {
  collectionMonth: SocialInsuranceCollectionMonth | undefined;
  payrollPaymentMonth: 'currentMonth' | 'nextMonth' | undefined;
  resignPremiumCollection: ResignPremiumCollectionType | undefined;
} {
  return {
    collectionMonth: tenant?.socialInsuranceSettings?.socialInsuranceCollectionMonth,
    payrollPaymentMonth: tenant?.socialInsuranceSettings?.payrollPaymentMonth,
    resignPremiumCollection:
      tenant?.socialInsuranceSettings?.resignPremiumCollection ?? 'monthly',
  };
}

export async function updateResignBulkPremiumForEmployee(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employee?: EmployeeDocument,
  tenant?: TenantDocumentForCalculation | null,
): Promise<void> {
  const [resolvedEmployee, resolvedTenant, records] = await Promise.all([
    employee ? Promise.resolve(employee) : getEmployee(db, tid, eid),
    tenant !== undefined ? Promise.resolve(tenant) : getTenant(db, tid),
    listEmployeeMonthlyRecords(db, tid, eid),
  ]);

  const employInfo = resolvedEmployee.employeeEmployInfo;
  const resignAt = toFormDate(employInfo?.resignAt);
  const licenceStartAt = toFormDate(employInfo?.licenseStartAt);
  const licenseEndAt = toFormDate(employInfo?.licenseEndAt);
  const settings = resolveTenantPremiumSettings(resolvedTenant);

  const premiumByMonth = new Map(
    records.map(({ yyyyMm, doc }) => [yyyyMm, doc.premiumData]),
  );

  const bulkPremium = computeResignBulkPremiumData({
    licenceStartAt,
    licenseEndAt,
    resignAt,
    collectionMonth: settings.collectionMonth,
    payrollPaymentMonth: settings.payrollPaymentMonth,
    resignPremiumCollection: settings.resignPremiumCollection,
    premiumByMonth,
  });

  if (!resignAt) {
    for (const { yyyyMm, doc } of records) {
      if (!doc.resignBulkPremiumData) {
        continue;
      }
      await db
        .collection('tenants')
        .doc(tid)
        .collection('monthly-records')
        .doc(yyyyMm)
        .collection('employees')
        .doc(eid)
        .update({
          resignBulkPremiumData: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    return;
  }

  const resignPayMonth = resignPayMonthYyyyMm(resignAt);
  const resignPayRef = db
    .collection('tenants')
    .doc(tid)
    .collection('monthly-records')
    .doc(resignPayMonth)
    .collection('employees')
    .doc(eid);
  const resignPaySnap = await resignPayRef.get();

  if (!bulkPremium) {
    if (resignPaySnap.exists && resignPaySnap.data()?.['resignBulkPremiumData']) {
      await resignPayRef.update({
        resignBulkPremiumData: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return;
  }

  if (!resignPaySnap.exists) {
    return;
  }

  await resignPayRef.update({
    resignBulkPremiumData: bulkPremium,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

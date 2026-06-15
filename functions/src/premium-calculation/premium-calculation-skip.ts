import * as admin from 'firebase-admin';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { toFormDate } from '../../../shared/date-utils';
import { shouldSkipPremiumCalculationForResignedEmployee } from '../../../shared/social-insurance/premium/insurance-period';

function employeeEmployDates(employee: EmployeeDocument) {
  const employInfo = employee.employeeEmployInfo;
  return {
    licenceStartAt: toFormDate(employInfo?.licenseStartAt),
    licenseEndAt: toFormDate(employInfo?.licenseEndAt),
    resignAt: toFormDate(employInfo?.resignAt),
  };
}

export function shouldSkipPremiumCalculation(
  employee: EmployeeDocument,
  yyyyMm: string,
): boolean {
  const { licenceStartAt, licenseEndAt, resignAt } = employeeEmployDates(employee);
  return shouldSkipPremiumCalculationForResignedEmployee(
    licenceStartAt,
    licenseEndAt,
    resignAt,
    yyyyMm,
  );
}

async function clearMonthlyPremiumFields(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<void> {
  const ref = db
    .collection('tenants')
    .doc(tid)
    .collection('monthly-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid);
  const snap = await ref.get();
  if (!snap.exists) {
    return;
  }
  const data = snap.data();
  if (!data?.premiumData && !data?.calculationSnapshot) {
    return;
  }
  await ref.update({
    premiumData: admin.firestore.FieldValue.delete(),
    calculationSnapshot: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function clearBonusPremiumFields(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
): Promise<void> {
  const ref = db
    .collection('tenants')
    .doc(tid)
    .collection('bonus-records')
    .doc(yyyyMm)
    .collection('employees')
    .doc(eid);
  const snap = await ref.get();
  if (!snap.exists) {
    return;
  }
  const data = snap.data();
  if (!data?.premiumData && !data?.calculationSnapshot) {
    return;
  }
  await ref.update({
    premiumData: admin.firestore.FieldValue.delete(),
    calculationSnapshot: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export async function skipMonthlyPremiumCalculationIfResigned(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  employee: EmployeeDocument,
): Promise<boolean> {
  if (!shouldSkipPremiumCalculation(employee, yyyyMm)) {
    return false;
  }
  await clearMonthlyPremiumFields(db, tid, eid, yyyyMm);
  return true;
}

export async function skipBonusPremiumCalculationIfResigned(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  yyyyMm: string,
  employee: EmployeeDocument,
): Promise<boolean> {
  if (!shouldSkipPremiumCalculation(employee, yyyyMm)) {
    return false;
  }
  await clearBonusPremiumFields(db, tid, eid, yyyyMm);
  return true;
}

import * as admin from 'firebase-admin';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { employeeLeaveRecordsToPeriodInputs } from '../../../shared/social-insurance/premium/leave-premium-exemption';
import {
  buildStandardZuijiApplicableNotificationBody,
  buildStandardZuijiApplicableNotificationTitle,
  buildTeijiNonTargetNotificationBody,
  buildTeijiNonTargetNotificationTitle,
  refineTeijiNonTargetReason,
  type TeijiNonTargetReason,
} from '../../../shared/social-insurance/remuneration/admin-alert-messages';
import type { PreviousGrades } from '../../../shared/social-insurance/remuneration/zuiji-determination';
import type { StandardZuijiDeterminationOutcome } from '../../../shared/social-insurance/remuneration/zuiji-determination';

export interface TeijiNonTargetAlertDocument {
  eid: string;
  teijiYear: number;
  screeningYyyyMm: string;
  effectiveYyyyMm: string;
  employeeDisplayName: string;
  reason: TeijiNonTargetReason;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface StandardZuijiAlertDocument {
  eid: string;
  changeMonthYyyyMm: string;
  effectiveYyyyMm: string;
  screeningYyyyMm: string;
  employeeDisplayName: string;
  previousHealthGrade: number;
  previousPensionGrade: number;
  newHealthGrade: number;
  newPensionGrade: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export function teijiNonTargetAlertDocId(eid: string, teijiYear: number): string {
  return `${eid}_${teijiYear}`;
}

export function standardZuijiAlertDocId(eid: string, changeMonthYyyyMm: string): string {
  return `${eid}_${changeMonthYyyyMm}`;
}

function teijiNonTargetAlertRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('teijiNonTargetAlerts')
    .doc(teijiNonTargetAlertDocId(eid, teijiYear));
}

function standardZuijiAlertRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  changeMonthYyyyMm: string,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('standardZuijiAlerts')
    .doc(standardZuijiAlertDocId(eid, changeMonthYyyyMm));
}

async function notifyTenantAdmins(
  db: admin.firestore.Firestore,
  tid: string,
  notifDoc: Record<string, unknown>,
): Promise<void> {
  const admins = await db
    .collection('tenants')
    .doc(tid)
    .collection('employees')
    .where('role', '==', 'admin')
    .get();

  for (const adminDoc of admins.docs) {
    const uid = adminDoc.data()?.uid as string | undefined;
    if (!uid) continue;
    await db.collection('accounts').doc(uid).collection('notifications').add(notifDoc);
  }
}

export async function ensureTeijiNonTargetAlert(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  screeningYyyyMm: string,
  employeeDisplayName: string,
  employee: EmployeeDocument,
  baseReason: TeijiNonTargetReason,
  teijiMonthKeys: readonly string[],
): Promise<void> {
  try {
    const reason = refineTeijiNonTargetReason(
      baseReason,
      employeeLeaveRecordsToPeriodInputs(employee.leaveInfo),
      teijiMonthKeys,
    );
    const effectiveYyyyMm = `${teijiYear}-09`;
    const ref = teijiNonTargetAlertRef(db, tid, eid, teijiYear);
    const existing = await ref.get();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const createdAt = existing.exists
      ? (existing.data()?.createdAt ?? now)
      : now;

    await ref.set({
      eid,
      teijiYear,
      screeningYyyyMm,
      effectiveYyyyMm,
      employeeDisplayName,
      reason,
      createdAt,
      updatedAt: now,
    });

    await notifyTenantAdmins(db, tid, {
      scope: 'tenant',
      type: 'teijiNonTarget',
      title: buildTeijiNonTargetNotificationTitle(employeeDisplayName, teijiYear),
      body: buildTeijiNonTargetNotificationBody(employeeDisplayName, teijiYear, reason),
      targetEid: eid,
      teijiYear,
      screeningYyyyMm,
      effectiveYyyyMm,
      reason,
      read: false,
      tid,
      createdAt: now,
    });
  } catch (err) {
    console.error('[teiji-non-target-alert] failed', { tid, eid, teijiYear, err });
  }
}

export async function ensureStandardZuijiApplicableAlert(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  changeMonthYyyyMm: string,
  effectiveYyyyMm: string,
  screeningYyyyMm: string,
  employeeDisplayName: string,
  previous: PreviousGrades,
  outcome: Extract<StandardZuijiDeterminationOutcome, { kind: 'applicable' }>,
): Promise<void> {
  try {
    const ref = standardZuijiAlertRef(db, tid, eid, changeMonthYyyyMm);
    const existing = await ref.get();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const createdAt = existing.exists
      ? (existing.data()?.createdAt ?? now)
      : now;

    const alert: Omit<StandardZuijiAlertDocument, 'createdAt' | 'updatedAt'> & {
      createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
      updatedAt: admin.firestore.FieldValue;
    } = {
      eid,
      changeMonthYyyyMm,
      effectiveYyyyMm,
      screeningYyyyMm,
      employeeDisplayName,
      previousHealthGrade: previous.healthGrade,
      previousPensionGrade: previous.pensionGrade,
      newHealthGrade: outcome.grades.health.grade,
      newPensionGrade: outcome.grades.pension.grade,
      createdAt,
      updatedAt: now,
    };
    await ref.set(alert);

    await notifyTenantAdmins(db, tid, {
      scope: 'tenant',
      type: 'standardZuijiApplicable',
      title: buildStandardZuijiApplicableNotificationTitle(
        employeeDisplayName,
        effectiveYyyyMm,
      ),
      body: buildStandardZuijiApplicableNotificationBody(
        employeeDisplayName,
        changeMonthYyyyMm,
        effectiveYyyyMm,
        previous.healthGrade,
        previous.pensionGrade,
        outcome.grades.health.grade,
        outcome.grades.pension.grade,
      ),
      targetEid: eid,
      changeMonthYyyyMm,
      effectiveYyyyMm,
      screeningYyyyMm,
      read: false,
      tid,
      createdAt: now,
    });
  } catch (err) {
    console.error('[standard-zuiji-alert] failed', {
      tid,
      eid,
      changeMonthYyyyMm,
      err,
    });
  }
}

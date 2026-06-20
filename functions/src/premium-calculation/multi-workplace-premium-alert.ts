import * as admin from 'firebase-admin';
import type { EmployeeDocument } from '../../../shared/employee-document';
import { hasMultipleWorkplacesEnabledForEmployee, isSelectedWorkplace } from '../../../shared/social-insurance/multi-workplace/multi-workplace-settings';
import {
  buildMultiWorkplaceManualPremiumNotificationBody,
  buildMultiWorkplaceManualPremiumNotificationTitle,
  type MultiWorkplacePremiumAlertTrigger,
} from '../../../shared/social-insurance/multi-workplace/multi-workplace-alert-messages';

export function multiWorkplacePremiumAlertDocId(
  eid: string,
  trigger: MultiWorkplacePremiumAlertTrigger,
  yyyyMm: string,
): string {
  return `${eid}_${trigger}_${yyyyMm}`;
}

function alertRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  trigger: MultiWorkplacePremiumAlertTrigger,
  yyyyMm: string,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('multiWorkplacePremiumAlerts')
    .doc(multiWorkplacePremiumAlertDocId(eid, trigger, yyyyMm));
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

export async function ensureMultiWorkplaceManualPremiumAlert(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employee: EmployeeDocument,
  params: {
    trigger: MultiWorkplacePremiumAlertTrigger;
    yyyyMm: string;
    employeeDisplayName?: string;
  },
): Promise<void> {
  if (!hasMultipleWorkplacesEnabledForEmployee(employee)) {
    return;
  }

  try {
    const ref = alertRef(db, tid, eid, params.trigger, params.yyyyMm);
    const existing = await ref.get();

    const employeeDisplayName =
      params.employeeDisplayName ??
      employee.employeePersonalInfo?.displayName ??
      '対象従業員';
    const now = admin.firestore.FieldValue.serverTimestamp();
    const createdAt = existing.exists
      ? (existing.data()?.createdAt ?? now)
      : now;

    await ref.set({
      eid,
      trigger: params.trigger,
      yyyyMm: params.yyyyMm,
      employeeDisplayName,
      createdAt,
      updatedAt: now,
    });

    await notifyTenantAdmins(db, tid, {
      scope: 'tenant',
      type: 'multiWorkplaceManualPremium',
      title: buildMultiWorkplaceManualPremiumNotificationTitle(
        employeeDisplayName,
        params.trigger,
      ),
      body: buildMultiWorkplaceManualPremiumNotificationBody(
        employeeDisplayName,
        params.trigger,
        params.yyyyMm,
        isSelectedWorkplace(employee.multiWorkplaceSettings),
      ),
      targetEid: eid,
      trigger: params.trigger,
      yyyyMm: params.yyyyMm,
      read: false,
      tid,
      createdAt: now,
    });
  } catch (err) {
    console.error('[multi-workplace-premium-alert] failed', {
      tid,
      eid,
      trigger: params.trigger,
      yyyyMm: params.yyyyMm,
      err,
    });
  }
}

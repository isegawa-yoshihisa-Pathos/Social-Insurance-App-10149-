import * as admin from 'firebase-admin';
import type { EmployeeDocument, EmployeeLeaveType } from '../../../shared/employee-document';
import {
  buildLeavePremiumExemptionNotificationBody,
  buildLeavePremiumExemptionNotificationTitle,
  type LeavePremiumAlertPremiumKind,
} from '../../../shared/social-insurance/premium/leave-premium-alert-messages';
import {
  detectLeavePremiumExemptions,
  type LeavePeriodInput,
} from '../../../shared/social-insurance/premium/leave-premium-exemption';

export function leavePremiumExemptionAlertDocId(
  eid: string,
  leaveType: Extract<EmployeeLeaveType, 'maternity' | 'childcare'>,
  yyyyMm: string,
  premiumKind: LeavePremiumAlertPremiumKind,
): string {
  return `${eid}_${leaveType}_${yyyyMm}_${premiumKind}`;
}

function alertRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  leaveType: Extract<EmployeeLeaveType, 'maternity' | 'childcare'>,
  yyyyMm: string,
  premiumKind: LeavePremiumAlertPremiumKind,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('leavePremiumExemptionAlerts')
    .doc(leavePremiumExemptionAlertDocId(eid, leaveType, yyyyMm, premiumKind));
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

export async function ensureLeavePremiumExemptionAlerts(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employee: EmployeeDocument,
  params: {
    yyyyMm: string;
    premiumKind: LeavePremiumAlertPremiumKind;
    leaveRecords?: readonly LeavePeriodInput[];
  },
): Promise<void> {
  const exemptions = detectLeavePremiumExemptions(
    params.yyyyMm,
    params.leaveRecords,
    params.premiumKind,
  );
  if (exemptions.length === 0) {
    return;
  }

  const employeeDisplayName =
    employee.employeePersonalInfo?.displayName ?? '対象従業員';

  for (const exemption of exemptions) {
    try {
      const ref = alertRef(
        db,
        tid,
        eid,
        exemption.leaveType,
        exemption.yyyyMm,
        params.premiumKind,
      );
      const existing = await ref.get();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const createdAt = existing.exists
        ? (existing.data()?.createdAt ?? now)
        : now;

      await ref.set({
        eid,
        leaveType: exemption.leaveType,
        yyyyMm: exemption.yyyyMm,
        premiumKind: params.premiumKind,
        employeeDisplayName,
        createdAt,
        updatedAt: now,
      });

      await notifyTenantAdmins(db, tid, {
        scope: 'tenant',
        type: 'leavePremiumExemption',
        title: buildLeavePremiumExemptionNotificationTitle(
          employeeDisplayName,
          exemption.leaveType,
          exemption.yyyyMm,
          params.premiumKind,
        ),
        body: buildLeavePremiumExemptionNotificationBody(
          employeeDisplayName,
          exemption.leaveType,
          exemption.yyyyMm,
          params.premiumKind,
        ),
        targetEid: eid,
        leaveType: exemption.leaveType,
        yyyyMm: exemption.yyyyMm,
        premiumKind: params.premiumKind,
        read: false,
        tid,
        createdAt: now,
      });
    } catch (err) {
      console.error('[leave-premium-exemption-alert] failed', {
        tid,
        eid,
        leaveType: exemption.leaveType,
        yyyyMm: exemption.yyyyMm,
        premiumKind: params.premiumKind,
        err,
      });
    }
  }
}

import * as admin from 'firebase-admin';
import type { EmployeeDocument } from '../../../shared/employee-document';
import {
  buildAgePremiumTransitionNotificationBody,
  buildAgePremiumTransitionNotificationTitle,
  type AgePremiumAlertPremiumKind,
} from '../../../shared/social-insurance/premium/age-premium-alert-messages';
import {
  detectAgePremiumTransitions,
  type AgePremiumTransitionKind,
  type DetectAgePremiumTransitionsInput,
} from '../../../shared/social-insurance/premium/age-premium-transition';

export function agePremiumTransitionAlertDocId(
  eid: string,
  kind: AgePremiumTransitionKind,
  yyyyMm: string,
  premiumKind: AgePremiumAlertPremiumKind,
): string {
  return `${eid}_${kind}_${yyyyMm}_${premiumKind}`;
}

function alertRef(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  kind: AgePremiumTransitionKind,
  yyyyMm: string,
  premiumKind: AgePremiumAlertPremiumKind,
) {
  return db
    .collection('tenants')
    .doc(tid)
    .collection('agePremiumTransitionAlerts')
    .doc(agePremiumTransitionAlertDocId(eid, kind, yyyyMm, premiumKind));
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

export async function ensureAgePremiumTransitionAlerts(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employee: EmployeeDocument,
  input: DetectAgePremiumTransitionsInput & {
    premiumKind: AgePremiumAlertPremiumKind;
  },
): Promise<void> {
  const transitions = detectAgePremiumTransitions(input);
  if (transitions.length === 0) {
    return;
  }

  const employeeDisplayName =
    employee.employeePersonalInfo?.displayName ?? '対象従業員';

  for (const transition of transitions) {
    try {
      const ref = alertRef(
        db,
        tid,
        eid,
        transition.kind,
        transition.yyyyMm,
        input.premiumKind,
      );
      const existing = await ref.get();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const createdAt = existing.exists
        ? (existing.data()?.createdAt ?? now)
        : now;

      await ref.set({
        eid,
        kind: transition.kind,
        yyyyMm: transition.yyyyMm,
        premiumKind: input.premiumKind,
        employeeDisplayName,
        createdAt,
        updatedAt: now,
      });

      await notifyTenantAdmins(db, tid, {
        scope: 'tenant',
        type: 'agePremiumTransition',
        title: buildAgePremiumTransitionNotificationTitle(
          employeeDisplayName,
          transition.kind,
          transition.yyyyMm,
          input.premiumKind,
        ),
        body: buildAgePremiumTransitionNotificationBody(
          employeeDisplayName,
          transition.kind,
          transition.yyyyMm,
          input.premiumKind,
        ),
        targetEid: eid,
        kind: transition.kind,
        yyyyMm: transition.yyyyMm,
        premiumKind: input.premiumKind,
        read: false,
        tid,
        createdAt: now,
      });
    } catch (err) {
      console.error('[age-premium-transition-alert] failed', {
        tid,
        eid,
        kind: transition.kind,
        yyyyMm: transition.yyyyMm,
        premiumKind: input.premiumKind,
        err,
      });
    }
  }
}

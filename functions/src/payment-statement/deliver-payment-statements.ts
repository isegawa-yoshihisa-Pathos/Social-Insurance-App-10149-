import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { assertTenantAdmin, mapCoreErrorToHttpsError } from '../core-functions';
import type { BonusDocument } from '../../../shared/bonus-document';
import type { EmployeeDocument } from '../../../shared/employee-document';
import type { MonthlyDocument } from '../../../shared/monthly-document';
import type { DeliverPaymentStatementsResult } from '../../../shared/payment-statement-delivery-document';
import {
  buildPaymentStatementDeliveredEmployeeBody,
  buildPaymentStatementDeliveredEmployeeTitle,
  buildPaymentStatementDeliveryAdminBody,
  buildPaymentStatementDeliveryAdminTitle,
} from '../../../shared/social-insurance/payment/payment-statement-delivery-messages';
import { resolvePaymentDisplaySourceMonths } from '../../../shared/social-insurance/payment/main-page-payment-display';
import { getTenant } from '../premium-calculation/repos';
import { hasBonusData } from '../../../shared/bonus-data.util';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export interface DeliverPaymentStatementsInput {
  tid: string;
  displayYyyyMm: string;
  eids?: string[];
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

function hasMonthlyPayrollData(doc: Partial<MonthlyDocument> | undefined): boolean {
  if (!doc?.payrollData) return false;
  const payroll = doc.payrollData;
  return (
    (payroll.basicSalary ?? 0) !== 0
    || (payroll.fringeBenefits ?? 0) !== 0
    || (doc.bonusRelatedRemuneration ?? 0) !== 0
    || (payroll.retroactivePay ?? 0) !== 0
    || Object.values(payroll.allowances ?? {}).some((v) => (v ?? 0) !== 0)
  );
}

function hasMonthlyPremiumData(doc: Partial<MonthlyDocument> | undefined): boolean {
  const premium = doc?.premiumData;
  if (!premium) return false;
  return (
    premium.healthInsurance.employee != null
    || premium.careInsurance.employee != null
    || premium.pensionInsurance.employee != null
  );
}

export const deliverPaymentStatements = onCall<DeliverPaymentStatementsInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, displayYyyyMm, eids } = request.data ?? {};
    if (!tid || !displayYyyyMm || !/^\d{4}-\d{2}$/.test(displayYyyyMm)) {
      throw new HttpsError('invalid-argument', 'tid と displayYyyyMm（YYYY-MM）は必須です。');
    }

    const db = admin.firestore();
    try {
      await assertTenantAdmin(db, uid, tid);
    } catch (e) {
      mapCoreErrorToHttpsError(e);
    }

    const tenant = await getTenant(db, tid);
    if (!tenant) {
      throw new HttpsError('not-found', '事業所が見つかりません。');
    }

    const payrollPaymentMonth =
      tenant.socialInsuranceSettings?.payrollPaymentMonth ?? 'currentMonth';
    const collectionMonth =
      tenant.socialInsuranceSettings?.socialInsuranceCollectionMonth ?? 'nextMonth';

    const { salaryMonth, premiumMonth } = resolvePaymentDisplaySourceMonths(
      displayYyyyMm,
      payrollPaymentMonth,
      collectionMonth,
    );

    const targetEids = eids?.length
      ? [...new Set(eids.filter((eid) => typeof eid === 'string' && eid.trim()))]
      : null;

    const [salarySnap, premiumSnap, bonusSnap, employeesSnap] = await Promise.all([
      db.collection('tenants').doc(tid).collection('monthly-records').doc(salaryMonth).collection('employees').get(),
      db.collection('tenants').doc(tid).collection('monthly-records').doc(premiumMonth).collection('employees').get(),
      db.collection('tenants').doc(tid).collection('bonus-records').doc(displayYyyyMm).collection('employees').get(),
      targetEids
        ? Promise.resolve(null)
        : db.collection('tenants').doc(tid).collection('employees').get(),
    ]);

    const salaryByEid = new Map(salarySnap.docs.map((d) => [d.id, d.data() as Partial<MonthlyDocument>]));
    const premiumByEid = new Map(premiumSnap.docs.map((d) => [d.id, d.data() as Partial<MonthlyDocument>]));
    const bonusByEid = new Map(bonusSnap.docs.map((d) => [d.id, d.data() as Partial<BonusDocument>]));

    const candidateEids = targetEids
      ?? [
          ...new Set([
            ...salaryByEid.keys(),
            ...premiumByEid.keys(),
            ...bonusByEid.keys(),
          ]),
        ];

    const now = admin.firestore.FieldValue.serverTimestamp();
    let delivered = 0;
    let skippedNoAccount = 0;
    let skippedNoData = 0;

    const batchLimit = 400;
    let batch = db.batch();
    let batchCount = 0;

    const commitBatch = async () => {
      if (batchCount === 0) return;
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    };

    for (const eid of candidateEids) {
      const salaryDoc = salaryByEid.get(eid);
      const premiumDoc = premiumByEid.get(eid);
      const bonusDoc = bonusByEid.get(eid);

      const hasSalary = hasMonthlyPayrollData(salaryDoc);
      const hasPremium = hasMonthlyPremiumData(premiumDoc);
      const hasBonus = bonusDoc ? hasBonusData(bonusDoc.bonusData) : false;

      if (!hasSalary && !hasPremium && !hasBonus) {
        skippedNoData += 1;
        continue;
      }

      const employeeRef = db.collection('tenants').doc(tid).collection('employees').doc(eid);

      let employeeSnap: FirebaseFirestore.DocumentSnapshot | undefined;
      if (employeesSnap) {
        employeeSnap = employeesSnap.docs.find((d) => d.id === eid);
        if (!employeeSnap) {
          skippedNoData += 1;
          continue;
        }
      } else {
        employeeSnap = await employeeRef.get();
        if (!employeeSnap.exists) {
          skippedNoData += 1;
          continue;
        }
      }

      const employee = employeeSnap.data() as Partial<EmployeeDocument> | undefined;
      const employeeUid = employee?.uid;

      batch.set(
        employeeRef.collection('paymentStatementDeliveries').doc(displayYyyyMm),
        {
          displayYyyyMm,
          hasMonthly: hasSalary || hasPremium,
          hasBonus,
          deliveredAt: now,
          deliveredByUid: uid,
        },
        { merge: true },
      );
      batchCount += 1;

      if (hasSalary) {
        batch.set(
          employeeRef.collection('deliveredSourceMonths').doc(salaryMonth),
          { displayYyyyMm, deliveredAt: now },
          { merge: true },
        );
        batchCount += 1;
      }

      if (hasPremium) {
        batch.set(
          employeeRef.collection('deliveredSourceMonths').doc(premiumMonth),
          { displayYyyyMm, deliveredAt: now },
          { merge: true },
        );
        batchCount += 1;
      }

      if (hasBonus) {
        batch.set(
          employeeRef.collection('deliveredBonusMonths').doc(displayYyyyMm),
          { displayYyyyMm, deliveredAt: now },
          { merge: true },
        );
        batchCount += 1;
      }

      if (employeeUid) {
        const notifRef = db
          .collection('accounts')
          .doc(employeeUid)
          .collection('notifications')
          .doc();
        batch.set(notifRef, {
          scope: 'personal',
          type: 'paymentStatementDelivered',
          title: buildPaymentStatementDeliveredEmployeeTitle(displayYyyyMm),
          body: buildPaymentStatementDeliveredEmployeeBody(displayYyyyMm),
          tid,
          targetEid: eid,
          displayYyyyMm,
          read: false,
          createdAt: now,
        });
        batchCount += 1;
      } else {
        skippedNoAccount += 1;
      }

      delivered += 1;

      if (batchCount >= batchLimit) {
        await commitBatch();
      }
    }

    batch.set(
      db.collection('tenants').doc(tid).collection('paymentStatementDeliveryStatus').doc(displayYyyyMm),
      {
        displayYyyyMm,
        deliveredCount: delivered,
        skippedNoAccount,
        lastDeliveredAt: now,
        lastDeliveredByUid: uid,
      },
      { merge: true },
    );
    batchCount += 1;

    await commitBatch();

    if (delivered === 0) {
      throw new HttpsError('failed-precondition', '送付対象の給与・賞与データがありません。');
    }

    await notifyTenantAdmins(db, tid, {
      scope: 'tenant',
      type: 'paymentStatementDeliveryCompleted',
      title: buildPaymentStatementDeliveryAdminTitle(displayYyyyMm),
      body: buildPaymentStatementDeliveryAdminBody(displayYyyyMm, delivered, skippedNoAccount),
      tid,
      displayYyyyMm,
      deliveredCount: delivered,
      skippedNoAccount,
      read: false,
      createdAt: now,
    });

    return {
      delivered,
      skippedNoAccount,
      skippedNoData,
    } satisfies DeliverPaymentStatementsResult;
  },
);

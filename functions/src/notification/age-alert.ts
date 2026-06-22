import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import {
  getAgeAttainmentYyyyMm,
  getCalendarDateInTimeZone,
  JAPAN_TIME_ZONE,
  toFormDate,
} from '../../../shared/date-utils';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const TARGET_AGES = [40, 65, 70, 75];

export const checkAgeAttainmentAlerts = onSchedule(
  {
    // 分(0-59) 時(0-23) 日(1-31) 月(1-12) 曜日(0-6)
    // 15分ごとに実行 */15 * * * *
    // 平日9時と18時に実行 0 9,18 * * 1-5
    schedule: '0 0 1 * *',
    timeZone: 'Asia/Tokyo',
    region: 'asia-northeast1',
  },
  async (event) => {
    const db = admin.firestore();
    const today = getCalendarDateInTimeZone(JAPAN_TIME_ZONE);

    if (today.getDate() !== 1) {
      return;
    }

    const targetYear = today.getFullYear() + (today.getMonth() === 11 ? 1 : 0);
    const targetMonth = (today.getMonth() + 1) % 12;
    const targetYyyyMm = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

    try {
      const tenantsSnapshot = await db.collection('tenants').get();

      for (const tenantDoc of tenantsSnapshot.docs) {
        const tid = tenantDoc.id;
        
        const employeesSnapshot = await db
          .collection('tenants')
          .doc(tid)
          .collection('employees')
          .get();

        for (const employeeDoc of employeesSnapshot.docs) {
          const employeeData = employeeDoc.data();
          if (!employeeData.birthDate) continue;

          const birthDate = toFormDate(employeeData.birthDate);
          if (!birthDate) continue;

          for (const age of TARGET_AGES) {
            const attainmentYyyyMm = getAgeAttainmentYyyyMm(birthDate, age);

            if (attainmentYyyyMm === targetYyyyMm) {
              await createAgeAlertNotifications(db, tid, employeeDoc.id, employeeData, age, targetYyyyMm);
            }
          }
        }
      }
    } catch (error) {
      console.error('年齢到達アラートのバッチ処理中にエラーが発生しました:', error);
    }
  }
);

async function createAgeAlertNotifications(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  employeeData: any,
  age: number,
  yyyyMm: string
) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  
  let legalReason = '';
  if (age === 40) legalReason = '介護保険第2号被保険者（介護保険料の徴収開始）';
  if (age === 65) legalReason = '介護保険第1号被保険者への移行（原則、給与からの介護保険料控除が終了）';
  if (age === 70) legalReason = '厚生年金保険被保険者資格喪失（70歳以上被用者該当に伴う、厚生年金保険料の免除）';
  if (age === 75) legalReason = '健康保険被保険者資格喪失（後期高齢者医療制度への移行に伴う、健康保険料の喪失）';

  const title = `【年齢到達アラート】${employeeData.name || '従業員'}様 満${age}歳到達`;

  await db.collection('tenants').doc(tid).collection('notifications').add({
    title,
    body: `${employeeData.name || '従業員'}様が、${yyyyMm}月に社会保険上の満${age}歳に到達（誕生日の前日）されます。給与計算時の保険料設定（${legalReason}）の変更手続きを行ってください。`,
    type: 'ageAttainment',
    scope: 'tenant',
    targetEid: eid,
    targetAge: age,
    attainmentYyyyMm: yyyyMm,
    read: false,
    createdAt: now,
  });

  if (employeeData.uid) {
    await db.collection('accounts').doc(employeeData.uid).collection('notifications').add({
      title: `【社会保険】満${age}歳到達に伴う保険料変更のお知らせ`,
      body: `いつもご利用ありがとうございます。お客様は${yyyyMm}月に満${age}歳に到達されるため、社会保険上の区分が変更（${legalReason}）となります。これに伴い、給与から控除される保険料が変更される場合がありますのであらかじめお知らせいたします。`,
      type: 'ageAttainment',
      scope: 'personal',
      read: false,
      createdAt: now,
    });
  }
}
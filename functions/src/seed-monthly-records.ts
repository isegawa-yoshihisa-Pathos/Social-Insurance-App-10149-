/**
 * 月次サンプルデータ投入スクリプト
 *
 * Usage (functions ディレクトリで):
 *   npm run seed:monthly -- <tenantId>
 *
 * 例:
 *   npm run seed:monthly -- abc123xyz
 *
 * 前提: firebase-admin が使える認証
 *   - GOOGLE_APPLICATION_CREDENTIALS にサービスアカウント JSON
 *   - または gcloud auth application-default login
 *
 * 認証が難しい場合: アプリの「月次管理 → 設定」画面の
 * 「サンプルデータ投入」ボタンを使う（ブラウザのログイン認証で書き込み）
 *
 * Project ID は次の順で解決: 環境変数 → .firebaserc → kensyu10149
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'kensyu10149';

function resolveProjectId(): string {
  const fromEnv =
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID;
  if (fromEnv) return fromEnv;

  try {
    const firebasercPath = resolve(__dirname, '../../.firebaserc');
    const raw = JSON.parse(readFileSync(firebasercPath, 'utf8')) as {
      projects?: { default?: string };
    };
    if (raw.projects?.default) return raw.projects.default;
  } catch {
    // .firebaserc が読めない場合はデフォルトへ
  }

  return DEFAULT_PROJECT_ID;
}

function initializeFirebaseAdmin(): void {
  if (admin.apps.length) return;
  const projectId = resolveProjectId();
  admin.initializeApp({ projectId });
  console.log(`Firebase Admin initialized (projectId: ${projectId})`);
}

const EIDS = [
  '1xPhzoDUSeuj5cYq1mwL',
  'CUoiFmn06wdfnkeLCDbq',
  'HRDSX0JKPXIvsyGBHWwf',
  'KRx4dxUml6rFKQ2eNZIm',
  'cyxoINgAMDSDbZOdU9hs',
  'lde0r5SXDWDzhmVAHbwt',
  'lzFoFuHub1K1levQyn4J',
  'moH9N4M9u6RaeeYs2LtY',
] as const;

/** アプリの yyyyMm と同じ形式（2026-01 〜 2026-06） */
const MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'] as const;

type StoredBonusType =
  | 'annual'
  | 'term_end'
  | 'incentive'
  | 'allowance'
  | 'special'
  | 'other';

type BonusMap = Partial<Record<StoredBonusType, number>>;

interface MonthlySeedDoc {
  uid: string;
  displayName: string;
  payrollData: {
    totalPay: number;
    basicSalary: number;
    overtimePay: number | null;
    commuterAllowance: number | null;
    otherAllowance: number | null;
    retroactivePay: number | null;
  };
  bonusData?: { bonus: BonusMap };
  premiumData: {
    healthInsurance: { employer: number; employee: number };
    careInsurance: { employer: number | null; employee: number | null };
    pensionInsurance: { employer: number; employee: number };
  };
  updatedAt: FieldValue;
}

function buildMonthlyDoc(
  displayName: string,
  uid: string,
  employeeIndex: number,
  yyyyMm: string,
): MonthlySeedDoc {
  const month = Number(yyyyMm.split('-')[1]);

  const basicSalary = 260_000 + employeeIndex * 12_000 + month * 1_500;
  const overtimePay = month % 2 === 0 ? 20_000 + employeeIndex * 2_000 : null;
  const commuterAllowance = 15_000;
  const otherAllowance = month === 3 ? 8_000 + employeeIndex * 500 : null;
  const retroactivePay = month === 1 ? 5_000 : null;

  const totalPay =
    basicSalary +
    (overtimePay ?? 0) +
    commuterAllowance +
    (otherAllowance ?? 0) +
    (retroactivePay ?? 0);

  const healthBase = Math.round(basicSalary * 0.0495);
  const pensionBase = Math.round(basicSalary * 0.0915);
  const hasCareInsurance = employeeIndex >= 4;

  const careEmployer = hasCareInsurance ? Math.round(basicSalary * 0.008) : null;
  const careEmployee = hasCareInsurance ? Math.round(basicSalary * 0.008) : null;

  const doc: MonthlySeedDoc = {
    uid,
    displayName,
    payrollData: {
      totalPay,
      basicSalary,
      overtimePay,
      commuterAllowance,
      otherAllowance,
      retroactivePay,
    },
    premiumData: {
      healthInsurance: { employer: healthBase, employee: healthBase },
      careInsurance: { employer: careEmployer, employee: careEmployee },
      pensionInsurance: { employer: pensionBase, employee: pensionBase },
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (month === 6) {
    const bonus: BonusMap = {
      annual: 150_000 + employeeIndex * 20_000,
    };
    if (employeeIndex % 2 === 0) {
      bonus.special = 50_000;
    }
    if (employeeIndex % 3 === 0) {
      bonus.term_end = 80_000 + employeeIndex * 5_000;
    }
    doc.bonusData = { bonus };
  }

  return doc;
}

async function resolveEmployeeMeta(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  index: number,
): Promise<{ displayName: string; uid: string }> {
  const snap = await db.doc(`tenants/${tid}/employees/${eid}`).get();
  if (!snap.exists) {
    return { displayName: `サンプル社員${index + 1}`, uid: '' };
  }
  const data = snap.data() as Record<string, unknown>;
  const personal = data['employeePersonalInfo'] as { displayName?: string } | undefined;
  const displayName =
    personal?.displayName ??
    (typeof data['displayName'] === 'string' ? data['displayName'] : `サンプル社員${index + 1}`);
  const uid = typeof data['uid'] === 'string' ? data['uid'] : '';
  return { displayName, uid };
}

async function resolveTenantId(
  db: admin.firestore.Firestore,
  explicitTid: string | undefined,
): Promise<string> {
  if (explicitTid) return explicitTid;

  console.log('Tenant ID 未指定。employees からテナントを検索します...');
  const tenantsSnap = await db.collection('tenants').get();
  for (const tenantDoc of tenantsSnap.docs) {
    const probe = await db.doc(`tenants/${tenantDoc.id}/employees/${EIDS[0]}`).get();
    if (probe.exists) {
      console.log(`  検出: ${tenantDoc.id}`);
      return tenantDoc.id;
    }
  }
  throw new Error(
    'テナントを特定できません。Usage: npm run seed:monthly -- <tenantId>',
  );
}

async function main(): Promise<void> {
  initializeFirebaseAdmin();
  const db = admin.firestore();
  const tid = await resolveTenantId(db, process.argv[2]?.trim());

  console.log(`Project: ${admin.app().options.projectId ?? '(default)'}`);
  console.log(`Tenant:  ${tid}`);
  console.log(`Months:  ${MONTHS.join(', ')}`);
  console.log(`Employees: ${EIDS.length}`);

  let writeCount = 0;
  const batch = db.batch();

  for (const yyyyMm of MONTHS) {
    for (let i = 0; i < EIDS.length; i++) {
      const eid = EIDS[i];
      const { displayName, uid } = await resolveEmployeeMeta(db, tid, eid, i);
      const payload = buildMonthlyDoc(displayName, uid, i, yyyyMm);
      const ref = db.doc(`tenants/${tid}/monthly-records/${yyyyMm}/employees/${eid}`);
      batch.set(ref, payload, { merge: true });
      writeCount++;
      console.log(`  + ${yyyyMm} / ${eid} (${displayName})`);
    }
  }

  await batch.commit();
  console.log(`\nDone. ${writeCount} documents written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as admin from 'firebase-admin';

export type PremiumCalculationKind = 'monthly' | 'bonus';

export interface CalculatePremiumTaskPayload {
  tid: string;
  jobId: string;
  eid: string;
  kind: PremiumCalculationKind;
  yyyyMm: string;
  createdBy: string;
}

export interface StartPremiumCalculationBatchInput {
  tid: string;
  kind: PremiumCalculationKind;
  yyyyMm: string;
  eids?: string[];
}

const YYYY_MM_PATTERN = /^\d{4}-\d{2}$/;

export function assertValidYyyyMm(yyyyMm: string): void {
  if (!YYYY_MM_PATTERN.test(yyyyMm)) {
    throw new Error('INVALID_ARGUMENT:yyyyMm の形式が正しくありません。');
  }
}

export function recordsCollectionPath(
  tid: string,
  kind: PremiumCalculationKind,
  yyyyMm: string,
): string {
  const root = kind === 'monthly' ? 'monthly-records' : 'bonus-records';
  return `tenants/${tid}/${root}/${yyyyMm}/employees`;
}

export async function resolveTargetEids(
  db: admin.firestore.Firestore,
  tid: string,
  kind: PremiumCalculationKind,
  yyyyMm: string,
  eids?: string[],
): Promise<string[]> {
  const collectionPath = recordsCollectionPath(tid, kind, yyyyMm);
  const snap = await db.collection(collectionPath).get();

  const available = new Set(snap.docs.map((doc) => doc.id));
  if (!eids || eids.length === 0) {
    return [...available];
  }

  const normalized = [...new Set(eids.map((eid) => eid.trim()).filter(Boolean))];
  return normalized.filter((eid) => available.has(eid));
}
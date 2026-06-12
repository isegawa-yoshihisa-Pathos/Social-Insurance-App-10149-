import * as admin from 'firebase-admin';
import {
  calculateBonusRemunerationAddition,
  buildBonusRelatedRemunerationApplicationMonthKeys,
  buildTeijiApplicationMonthKeys,
  qualifiesForTeijiBonusRemuneration,
  teijiBonusLookbackRange,
} from '../../../shared/social-insurance/remuneration/bonus-remuneration-addition';
import {
  getBonusTypeDefinitions,
  listBonusRecordsInRange,
  getMonthlyDocument,
  getMonthlyPeriod,
  updateMonthlyBonusRelatedRemuneration,
} from './repos';

export interface TeijiBonusRelatedRemunerationResult {
  addition: number;
  /** 12等分の対象賞与が1件以上ある（このときのみ月次へ上書きする） */
  qualifies: boolean;
}

/** 昨年7月〜当年6月の該当賞与から bonusRelatedRemuneration（12等分）を算定 */
export async function computeTeijiBonusRelatedRemuneration(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
): Promise<TeijiBonusRelatedRemunerationResult> {
  const { from, to } = teijiBonusLookbackRange(teijiYear);
  const [bonusRecords, bonusDefs] = await Promise.all([
    listBonusRecordsInRange(db, tid, eid, from, to),
    getBonusTypeDefinitions(db, tid),
  ]);
  const qualifies = qualifiesForTeijiBonusRemuneration(bonusRecords, bonusDefs);
  const addition = calculateBonusRemunerationAddition(bonusRecords, bonusDefs);
  return { addition, qualifies };
}

export async function computeTeijiBonusRelatedRemunerationAddition(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
): Promise<number> {
  const result = await computeTeijiBonusRelatedRemuneration(db, tid, eid, teijiYear);
  return result.addition;
}

export async function applyTeijiBonusRelatedRemunerationToMonthlyRecords(
  db: admin.firestore.Firestore,
  tid: string,
  eid: string,
  teijiYear: number,
  addition: number,
  effectiveFrom?: string,
): Promise<void> {
  const monthKeys = effectiveFrom
    ? buildBonusRelatedRemunerationApplicationMonthKeys(teijiYear, effectiveFrom)
    : buildTeijiApplicationMonthKeys(teijiYear);
  await Promise.all(
    monthKeys.map(async (ym) => {
      const period = await getMonthlyPeriod(db, tid, ym);
      if (period?.locked) return;

      const monthly = await getMonthlyDocument(db, tid, eid, ym);
      if (!monthly) return;

      await updateMonthlyBonusRelatedRemuneration(db, tid, eid, ym, addition);
    }),
  );
}

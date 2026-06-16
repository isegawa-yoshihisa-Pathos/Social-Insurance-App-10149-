import type { FirestoreTimestamp } from './firestore-types';
import type {
  RetroactivePayReviewItem,
  RetroactiveWageKind,
} from './social-insurance/remuneration/retroactive-remuneration';

export type RetroactiveRemunerationReviewType = 'teiji' | 'teiji_annual_average';

export type RetroactiveRemunerationReviewStatus =
  | 'pending_admin'
  | 'recalculated'
  | 'skipped';

export interface RetroactiveRemunerationProposedGrades {
  healthGrade: number;
  pensionGrade: number;
  healthStandardRemuneration: number;
  pensionStandardRemuneration: number;
  remuneration: number;
  effectiveFrom: string;
}

export interface RetroactiveRemunerationReviewDocument {
  type: RetroactiveRemunerationReviewType;
  eid: string;
  employeeDisplayName: string;
  status: RetroactiveRemunerationReviewStatus;
  teijiYear: number;
  screeningYyyyMm: string;
  windowMonthKeys: string[];
  calculationMonthKeys: string[];
  items: RetroactivePayReviewItem[];
  originalGrades?: RetroactiveRemunerationProposedGrades;
  proposedGrades?: RetroactiveRemunerationProposedGrades;
  linkedConsentReviewId?: string;
  reviewedByUid?: string;
  reviewedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export type { RetroactivePayReviewItem, RetroactiveWageKind };

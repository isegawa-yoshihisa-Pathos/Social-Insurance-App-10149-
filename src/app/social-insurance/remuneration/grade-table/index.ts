export { GRADE_TABLE_2020_09 } from './tables/2020-09';
export type {
  GradeLookupResult,
  RemunerationGradeRow,
  RemunerationGradeTableSet,
  ResolvedStandardRemuneration,
} from './types';
export {
  gradeDifference,
  resolveGradeFromStandardAmount,
  resolveGradesFromRemuneration,
  roundRemunerationForGrade,
} from './lookup';

import type { RemunerationGradeTableSet } from './types';
import { GRADE_TABLE_2020_09 } from './tables/2020-09';

export const CURRENT_GRADE_TABLE: RemunerationGradeTableSet = GRADE_TABLE_2020_09;
export { ASSOCIATION_RATE_TABLE_2026_03 } from './tables/2026-03';
export { resolveAssociationRates } from './lookup';
export type { AssociationRateTableSet, AssociationPrefectureRateRow } from './types';
export { buildAssociationInsuranceRatePayload } from './to-insurance-rate-payload';
import { ASSOCIATION_RATE_TABLE_2026_03 } from './tables/2026-03';

export const CURRENT_ASSOCIATION_RATE_TABLE = ASSOCIATION_RATE_TABLE_2026_03;
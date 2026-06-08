export { ASSOCIATION_RATE_TABLE_2026_03 } from './tables/2026-03';
export { ASSOCIATION_RATE_TABLE_2025_03 } from './tables/2025-03';
export { ASSOCIATION_RATE_TABLE_2024_03 } from './tables/2024-03';
export { ASSOCIATION_RATE_TABLE_2023_03 } from './tables/2023-03';
export { ASSOCIATION_RATE_TABLE_2022_03 } from './tables/2022-03';
export { resolveAssociationRates } from './lookup';
export type { AssociationRateTableSet, AssociationPrefectureRateRow } from './types';
export { buildAssociationInsuranceRatePayload } from './to-insurance-rate-payload';
import { ASSOCIATION_RATE_TABLE_2026_03 } from './tables/2026-03';

export const CURRENT_ASSOCIATION_RATE_TABLE = ASSOCIATION_RATE_TABLE_2026_03;
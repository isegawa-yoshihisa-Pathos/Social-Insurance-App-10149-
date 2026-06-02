import type { CombinationRateTableSet } from '../../types';

export const TJK_RATE_2026_03 = {
  combinationName: 'tjk',
  effectiveFrom: '2026-03-01',
  label: '令和8年度',
  healthInsuranceRate: 0.0940,
  careInsuranceRate: 0.0170,
  pensionInsuranceRate: 0.183,
} as const satisfies CombinationRateTableSet;
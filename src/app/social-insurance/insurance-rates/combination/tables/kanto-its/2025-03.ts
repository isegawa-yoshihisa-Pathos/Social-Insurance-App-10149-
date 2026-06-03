import type { CombinationRateTableSet } from '../../types';

export const KANTO_ITS_RATE_2025_03 = {
  combinationCode: 'kanto-its',
  combinationName: '関東ITソフトウェア健康保険組合',
  effectiveFrom: '2025-04-01',
  label: '令和7–8年度（3月分まで）',
  healthInsuranceRate: 0.0950,
  careInsuranceRate: 0.0180,
  pensionInsuranceRate: 0.183,
} as const satisfies CombinationRateTableSet;
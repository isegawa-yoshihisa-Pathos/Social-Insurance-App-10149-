import type { CombinationRateTableSet } from '../../types';

export const KANTO_ITS_RATE_2026_04 = {
  combinationCode: 'kanto-its',
  combinationName: '関東ITソフトウェア健康保険組合',
  effectiveFrom: '2026-04-01',
  label: '令和8年度（4月分から）',
  healthInsuranceRate: 0.0927,
  careInsuranceRate: 0.0180,
  pensionInsuranceRate: 0.183,
} as const satisfies CombinationRateTableSet;
import { KANTO_ITS_RATE_2025_03 } from './tables/kanto-its/2025-03';
import { KANTO_ITS_RATE_2026_04 } from './tables/kanto-its/2026-04';
import { TJK_RATE_2026_03 } from './tables/tjk/2026-03';
import type { CombinationRegistryEntry } from './types';

export const COMBINATION_RATE_REGISTRIES: readonly CombinationRegistryEntry[] = [
  {
    combinationCode: 'kanto-its',
    combinationName: '関東ITソフトウェア健康保険組合',
    tables: [KANTO_ITS_RATE_2025_03, KANTO_ITS_RATE_2026_04],
  },
  {
    combinationCode: 'tjk',
    combinationName: '東京情報サービス産業健康保険組合',
    tables: [TJK_RATE_2026_03],
  },
];
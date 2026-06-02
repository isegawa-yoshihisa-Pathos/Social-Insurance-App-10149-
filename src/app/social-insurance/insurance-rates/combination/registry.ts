import { KANTO_ITS_RATE_2025_03 } from './tables/kanto-its/2025-03';
import { KANTO_ITS_RATE_2026_04 } from './tables/kanto-its/2026-04';
import { TJK_RATE_2026_03 } from './tables/tjk/2026-03';
import type { CombinationRegistryEntry } from './types';

export const COMBINATION_RATE_REGISTRIES: readonly CombinationRegistryEntry[] = [
  {
    combinationName: 'kanto-its',
    tables: [KANTO_ITS_RATE_2025_03, KANTO_ITS_RATE_2026_04],
  },
  {
    combinationName: 'tjk',
    tables: [TJK_RATE_2026_03],
  },
];

export function getCombinationDisplayName(name: string): string {
  if (name === 'kanto-its') {
    return '関東ITソフトウェア健康保険組合';
  } else if (name === 'tjk') {
    return '東京情報サービス産業健康保険組合';
  } else {
    return name;
  }
}
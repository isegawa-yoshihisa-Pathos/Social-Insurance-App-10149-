import {
  BONUS_TYPE_LABELS,
  BonusMap,
  StoredBonusType,
  STORED_BONUS_TYPES,
} from '../../monthly-document';

export interface BonusDisplayParts {
  display: string;
  tooltip: string;
  total: number;
  entries: { type: StoredBonusType; amount: number }[];
}

/** 旧配列形式・オブジェクト形式の両方を BonusMap に正規化する */
export function normalizeBonusMap(raw: unknown): BonusMap {
  if (raw == null) return {};
  if (Array.isArray(raw)) {
    return raw.reduce<BonusMap>((acc, item) => {
      if (item == null || typeof item !== 'object') return acc;
      for (const [key, value] of Object.entries(item)) {
        if (!isStoredBonusType(key) || typeof value !== 'number' || value === 0) continue;
        acc[key] = (acc[key] ?? 0) + value;
      }
      return acc;
    }, {});
  }
  if (typeof raw !== 'object') return {};
  const map: BonusMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isStoredBonusType(key) || typeof value !== 'number' || value === 0) continue;
    map[key] = value;
  }
  return map;
}

export function sumBonusMap(bonus: BonusMap): number {
  return Object.values(bonus).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export function getBonusEntries(bonus: BonusMap): { type: StoredBonusType; amount: number }[] {
  return STORED_BONUS_TYPES.filter((type) => (bonus[type] ?? 0) !== 0).map((type) => ({
    type,
    amount: bonus[type]!,
  }));
}

export function buildBonusDisplayParts(bonus: BonusMap): BonusDisplayParts {
  const entries = getBonusEntries(bonus);
  const total = sumBonusMap(bonus);
  if (!entries.length) {
    return { display: '', tooltip: '', total: 0, entries };
  }

  const parts = entries.map(
    ({ type, amount }) => `${shortBonusLabel(type)}${formatBonusAmount(amount)}`,
  );
  const display =
    entries.length === 1
      ? parts[0]
      : `${parts.join('・')}（計${formatBonusAmount(total)}）`;

  const tooltip = entries
    .map(
      ({ type, amount }) =>
        `${BONUS_TYPE_LABELS[type]}: ${amount.toLocaleString('ja-JP')}円`,
    )
    .concat([`合計: ${total.toLocaleString('ja-JP')}円`])
    .join('\n');

  return { display, tooltip, total, entries };
}

export function formatBonusAmount(amount: number): string {
  if (amount >= 10_000 && amount % 10_000 === 0) {
    return `${amount / 10_000}万`;
  }
  return `${amount.toLocaleString('ja-JP')}円`;
}

export function shortBonusLabel(type: StoredBonusType): string {
  switch (type) {
    case 'annual':
      return '定期';
    case 'term_end':
      return '期末';
    case 'incentive':
      return 'インセンティブ';
    case 'allowance':
      return '臨時';
    case 'special':
      return '特別';
    case 'other':
      return 'その他';
  }
}

export function bonusColumnKey(type: StoredBonusType): `bonus_${StoredBonusType}` {
  return `bonus_${type}`;
}

export function isStoredBonusType(key: string): key is StoredBonusType {
  return (STORED_BONUS_TYPES as readonly string[]).includes(key);
}

export function isBonusDetailColumn(column: string): boolean {
  return column === 'bonus' || column.startsWith('bonus_');
}

export function bonusTypeFromColumnKey(
  column: string,
): StoredBonusType | null {
  if (!column.startsWith('bonus_')) return null;
  const type = column.slice('bonus_'.length);
  return isStoredBonusType(type) ? type : null;
}

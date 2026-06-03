import { BonusAmountMap, BonusTypeDefinition } from '../../bonus-document';
import { Format } from '../../format-number-jp';
import { sumBonusAmounts } from './bonus-data.util';

export interface BonusDisplayParts {
  display: string;
  tooltip: string;
  total: number;
  entries: { type: string; amount: number }[];
}

export function labelForBonusType(
  type: string,
  definitions: BonusTypeDefinition[],
): string {
  return definitions.find((def) => def.type === type)?.label ?? type;
}

export function getBonusEntries(
  amounts: BonusAmountMap,
  definitions: BonusTypeDefinition[],
): { type: string; amount: number }[] {
  const seen = new Set<string>();
  const entries: { type: string; amount: number }[] = [];

  for (const def of definitions) {
    const amount = amounts[def.type] ?? 0;
    if (amount !== 0) {
      entries.push({ type: def.type, amount });
      seen.add(def.type);
    }
  }

  for (const [type, amount] of Object.entries(amounts)) {
    if (!seen.has(type) && amount !== 0) {
      entries.push({ type, amount });
    }
  }

  return entries;
}

export function buildBonusDisplayParts(
  amounts: BonusAmountMap,
  definitions: BonusTypeDefinition[],
): BonusDisplayParts {
  const entries = getBonusEntries(amounts, definitions);
  const total = sumBonusAmounts(amounts);

  if (!entries.length) {
    return { display: '', tooltip: '', total: 0, entries };
  }

  const tooltip = entries
    .map(
      ({ type, amount }) =>
        `${labelForBonusType(type, definitions)}: ${Format(amount)}`,
    )
    .concat([`合計: ${Format(total)}`])
    .join('\n');

  return { display: Format(total), tooltip, total, entries };
}

export function bonusColumnKey(type: string): string {
  return type;
}

export function bonusTypeFromColumnKey(column: string): string | null {
  if (column === 'bonus') return null;

  if (/^bonus-\d+$/.test(column)) {
    return column;
  }

  if (column.startsWith('bonus_')) {
    return column.slice('bonus_'.length);
  }

  return null;
}

export function isKnownBonusType(
  type: string,
  definitions: BonusTypeDefinition[],
): boolean {
  return definitions.some((def) => def.type === type);
}

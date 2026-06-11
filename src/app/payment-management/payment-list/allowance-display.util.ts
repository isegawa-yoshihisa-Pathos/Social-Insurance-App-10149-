import { AllowanceData, AllowanceTypeDefinition } from '../../payment-document';
import { Format } from '../../format-number-jp';
import { sumAllowanceAmounts } from './allowance-data.util';
import { BASE_PAYMENT_LIST_COLUMN_KEYS } from './payment-list-column-keys';
import { PREMIUM_PAYMENT_LIST_COLUMN_KEYS } from '../payment-premium/payment-premium-columns';

export interface AllowanceDisplayParts {
  display: string;
  tooltip: string;
  total: number;
  entries: { type: string; amount: number }[];
}

const RESERVED_COLUMN_KEYS = new Set<string>([
  ...BASE_PAYMENT_LIST_COLUMN_KEYS,
  ...PREMIUM_PAYMENT_LIST_COLUMN_KEYS,
  'allowances',
]);

export function labelForAllowanceType(
  type: string,
  definitions: AllowanceTypeDefinition[],
): string {
  return definitions.find((def) => def.type === type)?.label ?? type;
}

export function getAllowanceEntries(
  amounts: AllowanceData,
  definitions: AllowanceTypeDefinition[],
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

export function buildAllowanceDisplayParts(
  amounts: AllowanceData,
  definitions: AllowanceTypeDefinition[],
): AllowanceDisplayParts {
  const entries = getAllowanceEntries(amounts, definitions);
  const total = sumAllowanceAmounts(amounts);

  if (!entries.length) {
    return { display: '', tooltip: '', total: 0, entries };
  }

  const tooltip = entries
    .map(
      ({ type, amount }) =>
        `${labelForAllowanceType(type, definitions)}: ${Format(amount)}`,
    )
    .concat([`合計: ${Format(total)}`])
    .join('\n');

  return { display: Format(total), tooltip, total, entries };
}

export function allowanceColumnKey(type: string): string {
  return type;
}

export function allowanceTypeFromColumnKey(column: string): string | null {
  if (RESERVED_COLUMN_KEYS.has(column)) {
    return null;
  }

  if (/^allowance-\d+$/.test(column)) {
    return column;
  }

  if (column.startsWith('allowance_')) {
    return column.slice('allowance_'.length);
  }

  if (
    column.startsWith('bonus-') ||
    column.endsWith('-bonus') ||
    column === 'bonus' ||
    column === 'bonusRelatedRemuneration' ||
    column.startsWith('bonusRelated') ||
    column.startsWith('bonusHealth') ||
    column.startsWith('bonusCare') ||
    column.startsWith('bonusPension') ||
    column.startsWith('standardBonus')
  ) {
    return null;
  }

  if ((PREMIUM_PAYMENT_LIST_COLUMN_KEYS as readonly string[]).includes(column)) {
    return null;
  }

  return column;
}

export function isKnownAllowanceType(
  type: string,
  definitions: AllowanceTypeDefinition[],
): boolean {
  return definitions.some((def) => def.type === type);
}

import {
  AllowanceTypeDefinition,
  DEFAULT_ALLOWANCE_TYPE_DEFINITIONS,
  WageCategory,
} from '../../payment-document';

const DEFAULT_WAGE_CATEGORY_BY_TYPE = new Map(
  DEFAULT_ALLOWANCE_TYPE_DEFINITIONS.map((def) => [def.type, def.wageCategory]),
);

function resolveWageCategory(type: string, wageCategory?: WageCategory): WageCategory {
  if (wageCategory === 'fixed' || wageCategory === 'variable') {
    return wageCategory;
  }
  return DEFAULT_WAGE_CATEGORY_BY_TYPE.get(type) ?? 'variable';
}

export function generateNextAllowanceType(existingTypes: Iterable<string>): string {
  let max = 0;
  for (const type of existingTypes) {
    const match = /^allowance-(\d+)$/.exec(type);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `allowance-${max + 1}`;
}

export function normalizeAllowanceTypeDefinitions(
  types: AllowanceTypeDefinition[],
): AllowanceTypeDefinition[] {
  const normalized: AllowanceTypeDefinition[] = [];
  const seenLabels = new Set<string>();
  const usedTypes = new Set<string>();

  for (const item of types) {
    const label = item.label.trim();
    if (!label || seenLabels.has(label)) continue;
    seenLabels.add(label);

    let type = item.type.trim();
    if (!type || type === 'total' || usedTypes.has(type)) {
      type = generateNextAllowanceType(usedTypes);
    }
    usedTypes.add(type);
    normalized.push({
      label,
      type,
      wageCategory: resolveWageCategory(type, item.wageCategory),
    });
  }

  return normalized;
}

import { BonusTypeDefinition } from '../../bonus-document';

export function generateNextBonusType(existingTypes: Iterable<string>): string {
  let max = 0;
  for (const type of existingTypes) {
    const match = /^bonus-(\d+)$/.exec(type);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `bonus-${max + 1}`;
}

export function normalizeBonusTypeDefinitions(
  types: BonusTypeDefinition[],
): BonusTypeDefinition[] {
  const normalized: BonusTypeDefinition[] = [];
  const seenLabels = new Set<string>();
  const usedTypes = new Set<string>();

  for (const item of types) {
    const label = item.label.trim();
    if (!label || seenLabels.has(label)) continue;
    seenLabels.add(label);

    let type = item.type.trim();
    if (!type || type === 'total' || usedTypes.has(type)) {
      type = generateNextBonusType(usedTypes);
    }
    usedTypes.add(type);
    normalized.push({ label, type, bonusFrequency: item.bonusFrequency });
  }

  return normalized;
}

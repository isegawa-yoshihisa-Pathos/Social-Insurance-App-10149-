export interface OrderedListColumnOption<T extends string> {
  key: T;
  label: string;
  checked: boolean;
}

export function normalizeVisibleColumnOrder<T extends string>(
  cols: readonly T[],
  validKeys: readonly T[],
  resolveKey: (col: T) => T | null,
): T[] {
  const valid = new Set<string>(validKeys);
  const result: T[] = [];
  const seen = new Set<string>();

  for (const col of cols) {
    const resolved = resolveKey(col);
    if (!resolved || !valid.has(resolved) || seen.has(resolved)) continue;
    result.push(resolved);
    seen.add(resolved);
  }

  return result;
}

export function buildOrderedColumnOptions<T extends string>(
  optionalColumns: readonly { key: T; label: string }[],
  visibleColumns: readonly T[],
): OrderedListColumnOption<T>[] {
  const optionalByKey = new Map(optionalColumns.map((col) => [col.key, col]));
  const ordered: OrderedListColumnOption<T>[] = [];
  const seen = new Set<T>();

  for (const key of visibleColumns) {
    const col = optionalByKey.get(key);
    if (!col || seen.has(key)) continue;
    ordered.push({ ...col, checked: true });
    seen.add(key);
  }

  for (const col of optionalColumns) {
    if (seen.has(col.key)) continue;
    ordered.push({ ...col, checked: false });
  }

  return ordered;
}

export function visibleColumnsFromOrder<T extends string>(
  ordered: readonly OrderedListColumnOption<T>[],
): T[] {
  return ordered.filter((col) => col.checked).map((col) => col.key);
}

/** Firestore に保存する前に undefined フィールドを除去する */
export function omitUndefinedFields<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedFields(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) {
        continue;
      }
      result[key] = omitUndefinedFields(nested);
    }
    return result as T;
  }
  return value;
}

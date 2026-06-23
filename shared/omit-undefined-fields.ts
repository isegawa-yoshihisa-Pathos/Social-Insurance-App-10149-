/** Firestore FieldValue（serverTimestamp 等）をそのまま保持する */
function isFirestoreFieldValue(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return '_methodName' in value || 'methodName' in value;
}

/** Firestore Timestamp をそのまま保持する */
function isFirestoreTimestamp(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { seconds?: unknown; nanoseconds?: unknown; toDate?: unknown };
  return (
    typeof candidate.seconds === 'number'
    && typeof candidate.nanoseconds === 'number'
    && typeof candidate.toDate === 'function'
  );
}

/** Firestore に保存する前に undefined フィールドを除去する */
export function omitUndefinedFields<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (isFirestoreFieldValue(value) || isFirestoreTimestamp(value)) {
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

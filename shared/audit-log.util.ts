import type { AuditLogChange } from './audit-log-document';

const SENSITIVE_FIELD_PATTERN = /(myNumber|password|token|secret)/i;
const MAX_SERIALIZED_LENGTH = 2000;

export function isSensitiveAuditField(field: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(field);
}

export function maskSensitiveAuditValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }
  const text = String(value);
  if (text.length <= 4) {
    return '****';
  }
  return `****${text.slice(-4)}`;
}

export function serializeAuditValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const timestamp = value as { toDate: () => Date };
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeAuditValue(item));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const serialized = serializeAuditValue(nested);
      result[key] = isSensitiveAuditField(key)
        ? maskSensitiveAuditValue(serialized)
        : serialized;
    }
    return result;
  }
  return value;
}

function truncateSerialized(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json.length <= MAX_SERIALIZED_LENGTH) {
    return value;
  }
  return `${json.slice(0, MAX_SERIALIZED_LENGTH)}…`;
}

export function sanitizeAuditValue(field: string, value: unknown): unknown {
  const serialized = serializeAuditValue(value);
  if (isSensitiveAuditField(field)) {
    return maskSensitiveAuditValue(serialized);
  }
  return truncateSerialized(serialized);
}

export function buildAuditLogChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[],
): AuditLogChange[] {
  const keys =
    fields ??
    [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  const changes: AuditLogChange[] = [];

  for (const field of keys) {
    const beforeValue = sanitizeAuditValue(field, before?.[field]);
    const afterValue = sanitizeAuditValue(field, after?.[field]);
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes.push({
        field,
        before: beforeValue,
        after: afterValue,
      });
    }
  }

  return changes;
}

export function formatAuditChangeValue(value: unknown): string {
  if (value == null || value === '') {
    return '（なし）';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

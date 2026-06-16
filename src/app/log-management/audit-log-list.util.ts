import type { AuditLogAction, AuditLogDocument } from './log-document';
import type { AuditLogListItem } from './log-data.service';
import { formatAuditLogChangeField } from '../../../shared/audit-log-display.util';

export type AuditLogSortColumn =
  | 'createdAt'
  | 'actor'
  | 'target'
  | 'action'
  | 'category'
  | 'summary';

export interface AuditLogSearchCriteria {
  keyword: string;
  action: AuditLogAction | '';
  category: string;
}

export function getAuditLogCreatedAtMillis(
  value: AuditLogDocument['createdAt'],
): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export function buildAuditLogSearchableText(
  item: AuditLogListItem,
  labels: {
    actionLabel: string;
    targetLabel: string;
    targetKindLabel: string;
    categoryLabel: string;
  },
): string {
  const doc = item.doc;
  const parts = [
    doc.actorDisplayName,
    doc.actorUid,
    doc.actorEmail,
    labels.targetLabel,
    doc.targetDisplayName,
    doc.targetEmployeeId,
    doc.targetResourceId,
    doc.targetLabel,
    labels.actionLabel,
    doc.action,
    doc.category,
    labels.categoryLabel,
    labels.targetKindLabel,
    doc.targetKind,
    doc.summary,
    ...(doc.changes?.map(
      (change) =>
        `${formatAuditLogChangeField(change.field)} ${String(change.before ?? '')} ${String(change.after ?? '')}`,
    ) ?? []),
  ];

  return parts
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ')
    .toLowerCase();
}

export function matchesAuditLogSearch(
  item: AuditLogListItem,
  criteria: AuditLogSearchCriteria,
  labels: {
    actionLabel: string;
    targetLabel: string;
    targetKindLabel: string;
    categoryLabel: string;
  },
): boolean {
  if (criteria.action && item.doc.action !== criteria.action) {
    return false;
  }

  if (criteria.category && item.doc.category !== criteria.category) {
    return false;
  }

  const keyword = criteria.keyword.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return buildAuditLogSearchableText(item, labels).includes(keyword);
}

export function getAuditLogSortValue(
  item: AuditLogListItem,
  column: AuditLogSortColumn,
  labels: {
    actionLabel: string;
    targetLabel: string;
    categoryLabel: string;
  },
): string | number {
  const doc = item.doc;
  switch (column) {
    case 'createdAt':
      return getAuditLogCreatedAtMillis(doc.createdAt);
    case 'actor':
      return doc.actorDisplayName || doc.actorUid || '';
    case 'target':
      return labels.targetLabel;
    case 'action':
      return labels.actionLabel;
    case 'category':
      return labels.categoryLabel || doc.category;
    case 'summary':
      return doc.summary;
    default:
      return '';
  }
}

export const AUDIT_LOG_TARGET_KIND_LABELS: Record<string, string> = {
  employee: '従業員',
  tenant: '事業所',
  monthly: '月次給与',
  bonus: '賞与',
  payment: '給与',
  application: '申請',
  settings: '設定',
  registration: '届出',
  account: 'アカウント',
  other: 'その他',
};

export function auditLogTargetKindLabel(kind: string): string {
  return AUDIT_LOG_TARGET_KIND_LABELS[kind] ?? kind;
}

import type { FirestoreTimestamp } from './firestore-types';

export type AuditLogAction = 'create' | 'update' | 'delete';

export type AuditLogTargetKind =
  | 'employee'
  | 'tenant'
  | 'monthly'
  | 'bonus'
  | 'payment'
  | 'application'
  | 'settings'
  | 'registration'
  | 'account'
  | 'other';

export interface AuditLogActor {
  uid: string;
  displayName: string;
  email?: string;
}

export interface AuditLogTarget {
  kind: AuditLogTargetKind;
  eid?: string;
  displayName?: string;
  employeeId?: string;
  resourceId?: string;
  label?: string;
}

export interface AuditLogChange {
  field: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditLogDocument {
  actorUid: string;
  actorDisplayName: string;
  actorEmail?: string;
  targetKind: AuditLogTargetKind;
  targetEid?: string;
  targetDisplayName?: string;
  targetEmployeeId?: string;
  targetResourceId?: string;
  targetLabel?: string;
  action: AuditLogAction;
  category: string;
  summary: string;
  changes?: AuditLogChange[];
  metadata?: Record<string, unknown>;
  createdAt: FirestoreTimestamp;
}

export interface AuditLogRecordInput {
  tid: string;
  action: AuditLogAction;
  category: string;
  summary: string;
  target: AuditLogTarget;
  changes?: AuditLogChange[];
  metadata?: Record<string, unknown>;
}

import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { AuditLogDocument } from './log-document';
import { formatAuditChangeValue } from '../../../shared/audit-log.util';

export interface AuditLogListItem {
  id: string;
  doc: AuditLogDocument;
}

@Injectable({ providedIn: 'root' })
export class LogDataService {
  private readonly firestore = inject(Firestore);

  async listRecent(tid: string, maxItems = 200): Promise<AuditLogListItem[]> {
    const snap = await getDocs(
      query(
        collection(this.firestore, 'tenants', tid, 'auditLogs'),
        orderBy('createdAt', 'desc'),
        limit(maxItems),
      ),
    );

    return snap.docs.map((item) => ({
      id: item.id,
      doc: item.data() as AuditLogDocument,
    }));
  }

  formatTimestamp(value: AuditLogDocument['createdAt']): string {
    if (!(value instanceof Timestamp)) {
      return '';
    }
    return value.toDate().toLocaleString('ja-JP');
  }

  actionLabel(action: AuditLogDocument['action']): string {
    switch (action) {
      case 'create':
        return '作成';
      case 'update':
        return '更新';
      case 'delete':
        return '削除';
    }
  }

  targetLabel(item: AuditLogListItem): string {
    const doc = item.doc;
    if (doc.targetDisplayName) {
      const employeeId = doc.targetEmployeeId ? `（${doc.targetEmployeeId}）` : '';
      return `${doc.targetDisplayName}${employeeId}`;
    }
    if (doc.targetLabel) {
      return doc.targetLabel;
    }
    if (doc.targetResourceId) {
      return doc.targetResourceId;
    }
    return '—';
  }

  formatChangeValue(value: unknown): string {
    return formatAuditChangeValue(value);
  }
}

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
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString('ja-JP');
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate?: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate().toLocaleString('ja-JP');
    }
    return '';
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

  formatChangeField(field: string): string {
    switch (field) {
      case 'displayName':
        return '氏名';
      case 'employeeId':
        return '社員番号';
      case 'email':
        return 'メールアドレス';
      case 'phoneNumber':
        return '電話番号';
      case 'birthDate':
        return '生年月日';
      case 'joinedAt':
        return '入社日';
      case 'resignAt':
        return '退職日';
      case 'licenseStartAt':
        return '資格取得日';
      case 'licenseEndAt':
        return '資格失効日';
      case 'healthInsuranceRecordNumber':
        return '健康保険証番号';
      case 'pensionInsuranceRecordNumber':
        return '厚生年金証番号';
      case 'realName':
        return '氏名';
      case 'myNumber':
        return '個人番号';
      case 'basicPensionNumber':
        return '厚生年金番号';
      case 'zipcode':
        return '郵便番号';
      case 'address':
        return '住所';
      case 'position':
        return '役職';
      case 'department':
        return '部署';
      case 'payType':
        return '給与区分';
      case 'employmentType':
        return '雇用形態';
      case 'status':
        return '勤務状況';
      case 'joinedAt':
        return '入社日';
      case 'resignAt':
        return '退職日';
      case 'licenseStartAt':
        return '資格取得日';
      case 'licenseEndAt':
        return '資格失効日';
      default:
        return field;
    }
  }
}

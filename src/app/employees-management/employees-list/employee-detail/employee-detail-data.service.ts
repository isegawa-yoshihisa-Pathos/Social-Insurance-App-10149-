import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { CurrentTenantService } from '../../../current-tenant.service';
import { AuthService } from '../../../auth.service';
import {
  EmployeeFormData,
  createEmptyEmployeeForm,
  employeePersonalInfoToForm,
} from '../../../personal-form-data';
import { EmployeeDocument, EmployeeEmployFormData, EmployeeLeaveRecord } from '../../../employee-document';
import {
  createEmptyEmployForm,
  employFormToSavePayload,
  employeeEmployInfoToForm,
} from '../../../employee-employ-form-data';
import { employeeLeaveRecordsToForm } from '../../../employee-leave.util';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { serializeAuditValue } from '../../../../../shared/audit-log.util';

@Injectable({
  providedIn: 'root',
})
export class EmployeeDetailDataService {
  private readonly firestore = inject(Firestore);
  private readonly tenant = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);
  private readonly auditLog = inject(AuditLogService);

  eid = '';
  loading = false;
  loaded = false;

  personalForm: EmployeeFormData = createEmptyEmployeeForm();
  employForm: EmployeeEmployFormData = createEmptyEmployForm();
  leaveRecords: EmployeeLeaveRecord[] = [];
  role: 'admin' | 'member' = 'member';

  async load(eid: string, force = false): Promise<void> {
    if (this.loaded && this.eid === eid && !force) return;

    const tid = this.tenant.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');

    this.loading = true;
    this.eid = eid;

    try {
      const snap = await getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid));
      if (!snap.exists()) throw new Error('従業員が見つかりません。');

      const data = snap.data() as Partial<EmployeeDocument>;

      this.personalForm = employeePersonalInfoToForm(data.employeePersonalInfo);
      this.employForm = employeeEmployInfoToForm(data.employeeEmployInfo);
      this.leaveRecords = employeeLeaveRecordsToForm(data.leaveInfo);
      this.role = data.role ?? 'member';
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async loadForCurrentUser(force = false): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');

    const tid = this.tenant.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');

    const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
    if (!accountSnap.exists()) throw new Error('アカウント情報が見つかりません。');

    const account = accountSnap.data();
    const eid =
      (account['affiliations']?.[tid] as string | undefined) ??
      this.tenant.currentAffiliation()?.eid;
    if (!eid) throw new Error('従業員情報が見つかりません。');

    await this.load(eid, force);
  }

  signOut(): void {
    this.reset();
  }

  private reset(): void {
    this.eid = '';
    this.loading = false;
    this.loaded = false;
    this.personalForm = createEmptyEmployeeForm();
    this.employForm = createEmptyEmployForm();
    this.leaveRecords = [];
    this.role = 'member';
  }

  async saveEmploy(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid || !this.eid) throw new Error('従業員情報の保存に必要な情報が不足しています。');

    const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', this.eid);
    const beforeSnap = await getDoc(employeeRef);
    const beforeEmploy = beforeSnap.data()?.['employeeEmployInfo'] as Record<string, unknown> | undefined;

    const payload = employFormToSavePayload(this.employForm);
    await updateDoc(employeeRef, {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    await this.auditLog.recordUpdate({
      tid,
      category: 'employee.employ',
      summary: '雇用情報を更新',
      target: this.auditLog.employeeTarget(
        this.eid,
        this.personalForm.displayName,
        this.employForm.employeeId,
      ),
      before: serializeAuditValue(beforeEmploy) as Record<string, unknown>,
      after: serializeAuditValue(payload.employeeEmployInfo) as Record<string, unknown>,
    });

    const uid = this.authService.uid();
    if (uid) {
      const accountSnap = await getDoc(doc(this.firestore, 'accounts', uid));
      const ownEid = accountSnap.data()?.['affiliations']?.[tid] as string | undefined;
      if (ownEid === this.eid) {
        await this.tenant.reloadCurrentEmployeeId(uid);
      }
    }
  }
}

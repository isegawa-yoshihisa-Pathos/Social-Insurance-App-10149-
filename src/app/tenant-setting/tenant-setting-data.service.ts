import { Injectable, inject } from '@angular/core';
import { CurrentTenantService } from '../current-tenant.service';
import { ProfileCompletionService } from '../profile-completion.service';
import { AuthService } from '../auth.service';
import { TenantsDataService } from '../tenants-data.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { serializeAuditValue } from '../../../shared/audit-log.util';
import {
  TenantFormData,
  createEmptyTenantForm,
  parsePhoneNumberRaw,
  tenantDocToForm,
  tenantFormToSavePayload,
} from '../tenant-form-data';

@Injectable({ providedIn: 'root' })
export class TenantSettingDataService {
  private readonly tenantService = inject(CurrentTenantService);
  private readonly profileCompletionService = inject(ProfileCompletionService);
  private readonly authService = inject(AuthService);
  private readonly tenantsDataService = inject(TenantsDataService);
  private readonly auditLog = inject(AuditLogService);

  form: TenantFormData = createEmptyTenantForm();
  tid = '';
  loading = false;
  loaded = false;

  private reset(): void {
    this.form = createEmptyTenantForm();
    this.tid = '';
    this.loading = false;
    this.loaded = false;
  }

  get hasTenantMissingFields(): boolean {
    return this.profileCompletionService.hasTenantMissingFields(this.form);
  }

  get hasSocialInsuranceSettingsMissingFields(): boolean {
    return this.profileCompletionService.hasSocialInsuranceSettingsMissingFields(
      this.form.socialInsuranceSettings,
    );
  }

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    const tid = this.tenantService.currentTid();
    if (!tid) throw new Error('事業所が見つかりません。');
    this.tid = tid;
    this.loading = true;
    try {
      const doc = await this.tenantsDataService.loadTenant(tid);
      if (!doc) throw new Error('事業所データが見つかりませんでした');
      this.form = tenantDocToForm(doc);
      this.profileCompletionService.updateFromTenantForm(this.form);
      this.loaded = true;
    } finally {
      this.loading = false;
    }
  }

  async reloadForTenantChange(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  async save(): Promise<void> {
    const uid = this.authService.uid();
    if (!uid) throw new Error('ユーザーが見つかりません。');
    if (!this.tid) throw new Error('事業所が見つかりません。');

    this.form.phoneNumber = parsePhoneNumberRaw(this.form.phoneNumberRaw);
    const payload = tenantFormToSavePayload(this.form);
    const beforeDoc = await this.tenantsDataService.loadTenant(this.tid);
    await this.tenantsDataService.saveTenant(this.tid, payload);

    await this.auditLog.recordUpdate({
      tid: this.tid,
      category: 'tenant.profile',
      summary: '事業所情報を更新',
      target: this.auditLog.tenantTarget(this.tid, this.form.tenantName),
      before: serializeAuditValue(beforeDoc) as Record<string, unknown>,
      after: serializeAuditValue(payload) as Record<string, unknown>,
    });
    await this.profileCompletionService.refresh(uid, this.tid);
    this.profileCompletionService.updateFromTenantForm(this.form);
  }

  signOut(): void {
    this.reset();
  }
}

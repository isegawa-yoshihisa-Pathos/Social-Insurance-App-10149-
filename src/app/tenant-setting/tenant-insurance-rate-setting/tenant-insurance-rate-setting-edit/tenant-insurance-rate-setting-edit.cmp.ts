import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDatepickerToggle } from '@angular/material/datepicker';
import { TenantInsuranceRateSettingDataService, type InsuranceRateEditForm } from '../tenant-insurance-rate-setting-data.service';
import { TenantSettingDataService } from '../../tenant-setting-data.service';
import { buildAssociationInsuranceRatePayload, CURRENT_ASSOCIATION_RATE_TABLE } from '../../../social-insurance/insurance-rates/association';
import { toFormDate, toYyyyMmDd } from '../../../date-utils';
import { roundPercent, roundRate } from '../../../../../shared/social-insurance/premium/rounding';
import { HelpContentCmp } from '../../../help-content/help-content.cmp';

@Component({
  selector: 'app-tenant-insurance-rate-setting-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatDatepickerToggle,
    HelpContentCmp,
  ],
  templateUrl: './tenant-insurance-rate-setting-edit.cmp.html',
  styleUrl: './tenant-insurance-rate-setting-edit.cmp.css'
})
export class TenantInsuranceRateSettingEditCmp implements OnInit {
  readonly dataService = inject(TenantInsuranceRateSettingDataService);
  readonly tenantSetting = inject(TenantSettingDataService);

  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly canceled = new EventEmitter<void>();

  readonly prefectures = CURRENT_ASSOCIATION_RATE_TABLE.prefectures;

  effectiveFromDate: Date | null = null;

  async ngOnInit(): Promise<void> {
    await this.dataService.initEditForm();
    this.effectiveFromDate = toFormDate(this.dataService.editForm().effectiveFrom);
  }

  private updateForm(updater: (form: InsuranceRateEditForm) => void): void {
    const current = this.dataService.editForm();
    const next: InsuranceRateEditForm = {
      ...current,
      employeeRate: { ...current.employeeRate },
      roundingBy: { ...current.roundingBy },
    };
    updater(next);
    this.dataService.editForm.set(next);
  }

  onEffectiveFromDateChange(date: Date | null): void {
    this.effectiveFromDate = date;
    const next = date ? toYyyyMmDd(date) : '';
    const form = this.dataService.editForm();
    if (!next || next === form.effectiveFrom) {
      return;
    }

    if (
      this.tenantSetting.form.socialInsuranceSettings.healthInsuranceType !== 'association' ||
      !form.prefectureCode
    ) {
      this.updateForm((f) => {
        f.effectiveFrom = next;
      });
      return;
    }

    const payload = buildAssociationInsuranceRatePayload(
      form.prefectureCode as Parameters<typeof buildAssociationInsuranceRatePayload>[0],
      this.dataService.getAssociationRateTable(next),
    );

    if (payload) {
      this.updateForm((f) => {
        f.effectiveFrom = next;
        f.healthInsuranceRate = payload.healthInsuranceRate;
        f.careInsuranceRate = payload.careInsuranceRate;
        f.pensionInsuranceRate = payload.pensionInsuranceRate;
        f.employeeRate = { ...payload.employeeRate };
      });
      return;
    }

    this.updateForm((f) => {
      f.effectiveFrom = next;
    });
  }

  get label(): string { return this.dataService.editForm().label; }
  set label(val: string) { this.updateForm(f => f.label = val); }

  get healthRate(): number { return roundPercent(this.dataService.editForm().healthInsuranceRate*100); }
  set healthRate(val: number) { this.updateForm(f => f.healthInsuranceRate = roundRate(val / 100)); }

  get careRate(): number { return roundPercent(this.dataService.editForm().careInsuranceRate*100); }
  set careRate(val: number) { this.updateForm(f => f.careInsuranceRate = roundRate(val / 100)); }

  get pensionRate(): number { return roundPercent(this.dataService.editForm().pensionInsuranceRate*100); }
  set pensionRate(val: number) { this.updateForm(f => f.pensionInsuranceRate = roundRate(val / 100)); }

  get healthShare(): number { return roundPercent(this.dataService.editForm().employeeRate.healthInsurance*100); }
  set healthShare(val: number) { this.updateForm(f => f.employeeRate.healthInsurance = roundRate(val / 100)); }

  get careShare(): number { return roundPercent(this.dataService.editForm().employeeRate.careInsurance*100); }
  set careShare(val: number) { this.updateForm(f => f.employeeRate.careInsurance = roundRate(val / 100)); }

  get pensionShare(): number { return roundPercent(this.dataService.editForm().employeeRate.pensionInsurance*100); }
  set pensionShare(val: number) { this.updateForm(f => f.employeeRate.pensionInsurance = roundRate(val / 100)); }

  get healthRounding(): number { return this.dataService.editForm().roundingBy.healthInsurance; }
  set healthRounding(val: number) { this.updateForm(f => f.roundingBy.healthInsurance = val); }

  get careRounding(): number { return this.dataService.editForm().roundingBy.careInsurance; }
  set careRounding(val: number) { this.updateForm(f => f.roundingBy.careInsurance = val); }

  get pensionRounding(): number { return this.dataService.editForm().roundingBy.pensionInsurance; }
  set pensionRounding(val: number) { this.updateForm(f => f.roundingBy.pensionInsurance = val); }

  get roundingBoundaryType() { return this.dataService.editForm().roundingBoundaryType; }
  set roundingBoundaryType(val: 'lessThan' | 'lessThanOrEqual') {
    this.updateForm((f) => {
      f.roundingBoundaryType = val;
    });
  }

  onPrefectureChange(prefCode: string): void {
    const target = this.prefectures.find(p => p.prefectureCode === prefCode);
    const effectiveFrom = this.dataService.editForm().effectiveFrom;

    const payload = buildAssociationInsuranceRatePayload(
      prefCode as Parameters<typeof buildAssociationInsuranceRatePayload>[0],
      this.dataService.getAssociationRateTable(effectiveFrom),
    );

    if (payload) {
      this.updateForm(f => {
        f.prefectureCode = prefCode;
        f.prefectureName = target ? target.prefectureName : null;
        f.healthInsuranceRate = payload.healthInsuranceRate;
        f.careInsuranceRate = payload.careInsuranceRate;
        f.pensionInsuranceRate = payload.pensionInsuranceRate;
        f.employeeRate = { ...payload.employeeRate };
      });
    }
  }

  isValid(): boolean {
    const form = this.dataService.editForm();
    if (!form.effectiveFrom || !form.label.trim()) return false;
    if (form.healthInsuranceRate < 0 || form.careInsuranceRate < 0 || form.pensionInsuranceRate < 0) return false;
    
    const r = form.roundingBy;
    if (r.healthInsurance < 0 || r.healthInsurance > 99) return false;
    if (r.careInsurance < 0 || r.careInsurance > 99) return false;
    if (r.pensionInsurance < 0 || r.pensionInsurance > 99) return false;

    return true;
  }

  async save(): Promise<void> {
    if (!this.isValid()) return;
    try {
      await this.dataService.saveNewRate();
      this.saved.emit();
    } catch (error) {
      console.error('Failed to append new insurance rate:', error);
    }
  }
}
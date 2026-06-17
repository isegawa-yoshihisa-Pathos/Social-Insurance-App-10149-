import { Injectable, inject, signal } from '@angular/core';
import { DEFAULT_ROUNDING_BY } from '../../social-insurance/monthly/social-insurance-document';
import type { EmployeeRateByInsurance, InsuranceRateSavePayload, InsuranceRateSource, RoundingByInsurance } from '../../social-insurance/monthly/social-insurance-document';
import { InsuranceRateDataService, type InsuranceRateListItem } from '../../social-insurance/monthly/insurance-rate-data.service';
import { TenantSettingDataService } from '../tenant-setting-data.service';
import { buildAssociationInsuranceRatePayload, CURRENT_ASSOCIATION_RATE_TABLE, ASSOCIATION_RATE_TABLES, type AssociationRateTableSet } from '../../social-insurance/insurance-rates/association';
import { buildCombinationInsuranceRatePayload, buildOtherCombinationInsuranceRatePayload, COMBINATION_RATE_REGISTRIES } from '../../social-insurance/insurance-rates/combination';
import { determineRateSource } from './determine-rate-source';
import { resolvePrefectureCodeFromAddress } from './resolve-prefecture-from-address';
import { ZipcodeToAddressService } from '../../zipcode-to-address.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

export interface InsuranceRateEditForm {
    effectiveFrom: string;
    label: string;
    prefectureCode: string | null;
    prefectureName: string | null;
    healthInsuranceRate: number;
    careInsuranceRate: number;
    pensionInsuranceRate: number;
    employeeRate: EmployeeRateByInsurance;
    roundingBy: RoundingByInsurance;
    usedMasterAutoFill: boolean;
    masterSnapshot: MasterRateSnapshot | null;
}

export interface MasterRateSnapshot {
    effectiveFrom: string;
    label: string;
    prefectureCode?: string;
    healthInsuranceRate: number;
    careInsuranceRate: number;
    pensionInsuranceRate: number;
    employeeRate: EmployeeRateByInsurance;
    roundingBy: RoundingByInsurance;
}

@Injectable({ providedIn: 'root' })
export class TenantInsuranceRateSettingDataService {
    private readonly rateData = inject(InsuranceRateDataService);
    private readonly tenantSetting = inject(TenantSettingDataService);
    private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
    private readonly auditLog = inject(AuditLogService);

    readonly rates = signal<InsuranceRateListItem[]>([]);
    readonly submitBusy = signal(false);
    readonly editForm = signal<InsuranceRateEditForm>(this.createEmptyForm());

    async loadRates(): Promise<void> {
        const tid = this.tenantSetting.tid;
        if (!tid) return;
        this.rates.set(await this.rateData.listRates(tid));
    }

    async resolveCurrentRate() {
        const tid = this.tenantSetting.tid;
        if (!tid) return null;
        return this.rateData.resolveRate(tid, this.today());
    }

    async initEditForm(): Promise<void> {
        const tenant = this.tenantSetting.form;
        const si = tenant.socialInsuranceSettings;
        const today = this.today();

        if (si.healthInsuranceType === 'association') {
            const zipcode = tenant.zipcode;
            const address1 = await this.zipcodeToAddressService.getPrefecture(zipcode);
            const pref = resolvePrefectureCodeFromAddress(
                address1,
                CURRENT_ASSOCIATION_RATE_TABLE,
            );
            const payload = buildAssociationInsuranceRatePayload(
                pref ?? '13',
                CURRENT_ASSOCIATION_RATE_TABLE,
            );
            if (payload) {
                this.patchFromPayload(payload, {
                    usedMasterAutoFill: true,
                    prefectureCode: pref ?? null,
                    roundingBy: { ...DEFAULT_ROUNDING_BY },
                });
                return;
            }
        }

        if (si.healthInsuranceType === 'combination' && si.combinationCode) {
            const code = si.combinationCode;

            if (code === '') {
                this.editForm.set(this.createEmptyForm(today));
                return;
            }

            if (code === 'other') {
                const payload = buildOtherCombinationInsuranceRatePayload(
                    si.combinationName ?? '未設定',
                    CURRENT_ASSOCIATION_RATE_TABLE,
                );
                if (payload) {
                    this.patchFromPayload(payload, {
                        usedMasterAutoFill: true,
                        roundingBy: { ...DEFAULT_ROUNDING_BY },
                    });
                    return;
                }
            }

            const payload = buildCombinationInsuranceRatePayload(
                COMBINATION_RATE_REGISTRIES,
                code,
                today,
            );
            if (payload) {
                this.patchFromPayload(payload, {
                    usedMasterAutoFill: true,
                    roundingBy: { ...DEFAULT_ROUNDING_BY },
                });
                return;
            }
        }

        this.editForm.set(this.createEmptyForm(today));
    }

    async saveNewRate(): Promise<void> {
        const tid = this.tenantSetting.tid;
        if (!tid) throw new Error('事業所が見つかりません');

        const tenant = this.tenantSetting.form;
        const form = this.editForm();

        const rateSource = determineRateSource({
            healthInsuranceType: tenant.socialInsuranceSettings.healthInsuranceType,
            combinationCode: tenant.socialInsuranceSettings.combinationCode,
            usedMasterAutoFill: form.usedMasterAutoFill,
            valuesMatchMaster: this.valuesMatchMaster(form),
        });

        const payload: InsuranceRateSavePayload = {
            effectiveFrom: form.effectiveFrom,
            label: form.label ?? '',
            rateSource: rateSource as InsuranceRateSource,
            prefectureCode:
                tenant.socialInsuranceSettings.healthInsuranceType === 'association'
                ? form.prefectureCode ?? '' : '',
            healthInsuranceRate: form.healthInsuranceRate,
            careInsuranceRate: form.careInsuranceRate,
            pensionInsuranceRate: form.pensionInsuranceRate,
            employeeRate: form.employeeRate,
            roundingBy: form.roundingBy,
        };

        this.submitBusy.set(true);
        try {
            await this.rateData.addRate(tid, payload);
            await this.loadRates();

            await this.auditLog.recordCreate({
                tid,
                category: 'settings.insurance_rate',
                summary: '保険料率を追加',
                target: this.auditLog.settingsTarget(payload.effectiveFrom, payload.label),
                after: payload as unknown as Record<string, unknown>,
            });
        } finally {
            this.submitBusy.set(false);
        }
    }

    private createEmptyForm(effectiveFrom = this.today()): InsuranceRateEditForm {
        return {
            effectiveFrom,
            label: '',
            prefectureCode: null,
            prefectureName: null,
            healthInsuranceRate: 0,
            careInsuranceRate: 0,
            pensionInsuranceRate: 0.183,
            employeeRate: { healthInsurance: 0, careInsurance: 0, pensionInsurance: 0 },
            roundingBy: { ...DEFAULT_ROUNDING_BY },
            usedMasterAutoFill: false,
            masterSnapshot: null,
        };
    }

    private patchFromPayload(
        payload: InsuranceRateSavePayload,
        extra: Partial<InsuranceRateEditForm>,
    ): void {
        const roundingBy =
        typeof (payload as any).roundingBy === 'number'
            ? { ...DEFAULT_ROUNDING_BY }
            : (payload as any).roundingBy;

        const next: InsuranceRateEditForm = {
            ...this.createEmptyForm(payload.effectiveFrom || extra.effectiveFrom),
            label: payload.label ?? '',
            healthInsuranceRate: payload.healthInsuranceRate,
            careInsuranceRate: payload.careInsuranceRate,
            pensionInsuranceRate: payload.pensionInsuranceRate,
            employeeRate: payload.employeeRate,
            roundingBy,
            usedMasterAutoFill: extra.usedMasterAutoFill ?? false,
            masterSnapshot: {
                effectiveFrom: payload.effectiveFrom,
                label: payload.label ?? '',
                prefectureCode: payload.prefectureCode,
                healthInsuranceRate: payload.healthInsuranceRate,
                careInsuranceRate: payload.careInsuranceRate,
                pensionInsuranceRate: payload.pensionInsuranceRate,
                employeeRate: payload.employeeRate,
                roundingBy,
            },
            ...extra,
        };
        this.editForm.set(next);
    }

    private valuesMatchMaster(form: InsuranceRateEditForm): boolean {
        const m = form.masterSnapshot;
        if (!m) return false;
        return (
            form.healthInsuranceRate === m.healthInsuranceRate &&
            form.careInsuranceRate === m.careInsuranceRate &&
            form.pensionInsuranceRate === m.pensionInsuranceRate &&
            form.employeeRate.healthInsurance === m.employeeRate.healthInsurance &&
            form.employeeRate.careInsurance === m.employeeRate.careInsurance &&
            form.employeeRate.pensionInsurance === m.employeeRate.pensionInsurance &&
            form.effectiveFrom === m.effectiveFrom
        );
    }

    private today(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    getAssociationRateTable(date: string): AssociationRateTableSet {
        const tables = ASSOCIATION_RATE_TABLES;
        const table = tables.find(t => t.effectiveFrom <= date);
        return table ?? tables[0];
    }
}
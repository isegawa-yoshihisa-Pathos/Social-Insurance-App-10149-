import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, updateDoc } from '@angular/fire/firestore';
import { toFormDate } from '../../date-utils';
import { CalculationSnapshot, MonthlyDocument, PremiumData } from '../../monthly-document';
import { EmployeeDocument } from '../../employee-document';
import { calculateMonthlyPremium } from '../premium/premium-calculator';
import { determineInitial } from '../remuneration/initial-determination';
import { determineTeiji } from '../remuneration/teiji-determination';
import { determineStandardZuiji } from '../remuneration/zuiji-determination';
import { toMonthPaymentBaseInput, type MonthlyRemunerationSource } from '../remuneration/remuneration-month-input';
import { StandardRemunerationSavePayload, StandardRemunerationDataService } from './standard-remuneration-data.service';
import { InsuranceRateDataService } from './insurance-rate-data.service';
import { StandardRemunerationDocument, StandardRemunerationSource } from './social-insurance-document';
import { addMonths, daysInMonth, parseYyyyMm } from './social-insurance-data.util';
import type { ResolvedStandardRemuneration } from '../remuneration/grade-table';
import type { PreviousGrades } from '../remuneration/zuiji-determination';


export interface CalculationEmployeeMonthResult {
    premiumData: PremiumData;
    calculationSnapshot: Omit<CalculationSnapshot, 'calculatedAt'>;
    standardRemuneration: StandardRemunerationSavePayload;
}

export interface CalculationContext {
    employee: EmployeeDocument;
    monthly: MonthlyDocument;
    employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
    birthDate: Date | null;
}

@Injectable({ providedIn: 'root' })
export class SocialInsuranceCalculationService {
    private readonly firestore = inject(Firestore);
    private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);
    private readonly insuranceRateDataService = inject(InsuranceRateDataService);

    async calculateAndPersist(
        tid: string,
        eid: string,
        yyyyMm: string,
    ): Promise<void> {
        const ctx = await this.loadContext(tid, eid, yyyyMm);
        if (!ctx.employee.employeeEmployInfo?.licenseStartAt) {
            throw new Error('社会保険の資格取得日が設定されていません。');
        }
        const rawStandardRemuneration = await this.resolveStandardRemuneration(tid, eid, yyyyMm, ctx);

        if (rawStandardRemuneration.source !== 'carried')  {
            await this.standardRemunerationDataService.save(tid, eid, rawStandardRemuneration.effectiveFrom, rawStandardRemuneration);
        }

        const standardRemuneration = await this.standardRemunerationDataService.getLatest(tid, eid, yyyyMm) ?? rawStandardRemuneration;

        const rate = await this.insuranceRateDataService.resolveRateForMonth(tid, yyyyMm);
        if (!rate) {
            return;
        }
        
        const premiumData = calculateMonthlyPremium({
            yyyyMm,
            birthDate: ctx.birthDate,
            standardRemuneration: standardRemuneration.standardRemuneration,
            rates: rate.rates,
            employeeRate: rate.employeeRate,
            roundingBy: rate.roundingBy,
        });

        const calculationSnapshot: Omit<CalculationSnapshot, 'calculatedAt'> = {
            rateId: rate.rateId,
            effectiveFrom: rate.effectiveFrom,
            rates: {
                health: rate.rates.healthInsuranceRate,
                care: rate.rates.careInsuranceRate,
                pension: rate.rates.pensionInsuranceRate,
            },
            employeeRate: {
                health: rate.employeeRate.healthInsurance,
                care: rate.employeeRate.careInsurance,
                pension: rate.employeeRate.pensionInsurance,
            },
            roundingBy: {
                health: rate.roundingBy.healthInsurance,
                care: rate.roundingBy.careInsurance,
                pension: rate.roundingBy.pensionInsurance,
            },
            healthGrade: standardRemuneration.healthGrade,
            pensionGrade: standardRemuneration.pensionGrade,
            standardRemuneration: standardRemuneration.standardRemuneration,
            remuneration: standardRemuneration.remuneration,
            source: standardRemuneration.source,
        };

        const monthlyRef = doc(
            this.firestore,
            'tenants',
            tid,
            'monthly-records',
            yyyyMm,
            'employees',
            eid,
        );

        const payRollData = ctx.monthly.payrollData;

        await updateDoc(monthlyRef, {
            payrollData: {
                ...payRollData,
            },
            premiumData,
            calculationSnapshot: {
                ...calculationSnapshot,
                calculatedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
        });
    }

    private async resolveStandardRemuneration(
        tid: string,
        eid: string,
        yyyyMm: string,
        ctx: CalculationContext,
    ): Promise<StandardRemunerationSavePayload> {
        const existing = await this.standardRemunerationDataService.get(
            tid,
            eid,
            yyyyMm,
        );
        if (existing?.source === 'manual') {
            return this.toSavePayload(existing);
        }
        const zuiji = await this.tryZuiji(tid, eid, yyyyMm, ctx);
        if (zuiji) return zuiji;

        const teiji = await this.tryTeiji(tid, eid, yyyyMm, ctx);
        if (teiji) return teiji;

        const initial = await this.tryInitial(tid, eid, yyyyMm, ctx);
        if (initial) return initial;

        const carried = await this.carryForwardPrevious(tid, eid, yyyyMm, ctx);
        if (carried) return carried;
        throw new Error(
          `${yyyyMm} の標準報酬を決定できません。月次給与または過去の標準報酬履歴を確認してください。`,
        );
      }

    private async tryZuiji(
        tid: string,
        eid: string,
        yyyyMm: string,
        ctx: CalculationContext,
    ): Promise<StandardRemunerationSavePayload | null> {
        const monthKeys = [
            addMonths(yyyyMm, -3),
            addMonths(yyyyMm, -2),
            addMonths(yyyyMm, -1),
            yyyyMm,
        ];
        const sources = await this.loadMonthSources(tid, eid, monthKeys);
        if (sources.length !== 4) return null;

        const previousPayroll = sources[0].payroll.basicSalary + (sources[0].payroll.commuterAllowance ?? 0) + (sources[0].payroll.otherAllowance ?? 0);
        const currentPayroll = sources[1].payroll.basicSalary + (sources[1].payroll.commuterAllowance ?? 0) + (sources[1].payroll.otherAllowance ?? 0);
        if (previousPayroll === currentPayroll) {
            return null;
        }

        const previous = await this.getPreviousGrades(tid, eid, addMonths(yyyyMm, -3));
        if (!previous) return null;

        const outcome = determineStandardZuiji(
            ctx.employmentType,
            sources.slice(1),
            previous,
        );
        if (outcome.kind !== 'applicable') return null;

        return this.gradesToPayload('zuiji', addMonths(yyyyMm, 1), outcome.grades);
    }

    private async tryTeiji(
        tid: string,
        eid: string,
        yyyyMm: string,
        ctx: CalculationContext,
    ): Promise<StandardRemunerationSavePayload | null> {
        const { year, month } = parseYyyyMm(yyyyMm);
        if (month !== 7) return null;
        const licenseStartAt = ctx.employee.employeeEmployInfo?.licenseStartAt;
        if (!licenseStartAt) return null;
        if (licenseStartAt.toDate().getFullYear() === year && licenseStartAt.toDate().getMonth() === 6) return null;

        const history = await this.standardRemunerationDataService.listForEmployee(
            tid,
            eid,
        );
        const prior = history.find((item) => item.yyyyMm === yyyyMm);
        if (prior && prior.doc.source === 'zuiji') return null;

        const monthKeys = [
            `${year}-04`,
            `${year}-05`,
            `${year}-06`,
        ];
        const sources = await this.loadMonthSources(tid, eid, monthKeys);
        if (sources.length === 0) return null;

        const outcome = determineTeiji(
            ctx.employmentType,
            sources.map((s) => toMonthPaymentBaseInput(s)),
        );
        if (outcome.kind !== 'calculated') return null;

        const effectiveFrom = `${year}-09`;
        return this.gradesToPayload('teiji', effectiveFrom, outcome.grades);
    }

    private async tryInitial(
        tid: string,
        eid: string,
        yyyyMm: string,
        ctx: CalculationContext,
    ): Promise<StandardRemunerationSavePayload | null> {
        const history = await this.standardRemunerationDataService.listForEmployee(
            tid,
            eid,
        );
        const hasPrior = history.some((item) => item.yyyyMm < yyyyMm);
        if (hasPrior) return null;

        const outcome = determineInitial(ctx.monthly.payrollData);
        if (outcome.kind !== 'calculated') return null;

        return this.gradesToPayload('initial', yyyyMm, outcome.grades);
    }

    private async carryForwardPrevious(
        tid: string,
        eid: string,
        yyyyMm: string,
        ctx: CalculationContext,
    ): Promise<StandardRemunerationSavePayload | null> {
        const history = await this.standardRemunerationDataService.listForEmployee(
            tid,
            eid,
        );
        const prior = history.find((item) => item.yyyyMm < yyyyMm);
        if (!prior) {
            const outcome = determineInitial(ctx.monthly.payrollData);
            if (outcome.kind !== 'calculated') return null;
            return this.gradesToPayload('initial', yyyyMm, outcome.grades);
        }
        return {
            healthGrade: prior.doc.healthGrade,
            pensionGrade: prior.doc.pensionGrade,
            standardRemuneration: prior.doc.standardRemuneration,
            source: 'carried',
            effectiveFrom: prior.doc.effectiveFrom,
            remuneration: prior.doc.remuneration,
        };
    }

    private gradesToPayload(
        source: StandardRemunerationSource,
        yyyyMm: string,
        grades: ResolvedStandardRemuneration,
    ): StandardRemunerationSavePayload {
        return {
            healthGrade: grades.health.grade,
            pensionGrade: grades.pension.grade,
            standardRemuneration: {
                health: grades.health.standardRemuneration,
                pension: grades.pension.standardRemuneration,
            },
            source,
            effectiveFrom: yyyyMm,
            remuneration: grades.remuneration,
        };
    }

    private toSavePayload(
        doc: StandardRemunerationDocument,
    ): StandardRemunerationSavePayload {
        return {
            healthGrade: doc.healthGrade,
            pensionGrade: doc.pensionGrade,
            standardRemuneration: doc.standardRemuneration,
            source: doc.source,
            effectiveFrom: doc.effectiveFrom,
            remuneration: doc.remuneration,
        };
    }

    private async getPreviousGrades(
        tid: string,
        eid: string,
        beforeYyyyMm: string,
    ): Promise<PreviousGrades | null> {
        const history = await this.standardRemunerationDataService.listForEmployee(
            tid,
            eid,
        );
        const prior = history.find((item) => item.yyyyMm <= beforeYyyyMm);
        if (!prior) return null;
        return {
            healthGrade: prior.doc.healthGrade,
            pensionGrade: prior.doc.pensionGrade,
        };
    }

    private async loadMonthSources(
        tid: string,
        eid: string,
        monthKeys: readonly string[],
    ): Promise<MonthlyRemunerationSource[]> {
        const sources: MonthlyRemunerationSource[] = [];
        for (const ym of monthKeys) {
            const monthly = await this.loadMonthlyDocument(tid, eid, ym);
            if (!monthly?.payrollData) continue;
            sources.push({
                yyyyMm: ym,
                hasMonthlyRecord: true,
                daysInMonth: daysInMonth(ym),
                payroll: monthly.payrollData,
            });
        }
        return sources;
    }

    private async loadContext(
        tid: string,
        eid: string,
        yyyyMm: string,
    ): Promise<CalculationContext> {
        const [employeeSnap, monthly] = await Promise.all([
            getDoc(doc(this.firestore, 'tenants', tid, 'employees', eid)),
            this.loadMonthlyDocument(tid, eid, yyyyMm),
        ]);
        if (!employeeSnap.exists()) {
            throw new Error('従業員が見つかりません。');
        }
        if (!monthly?.payrollData) {
            throw new Error(`${yyyyMm} の月次給与データがありません。`);
        }
        const employee = employeeSnap.data() as EmployeeDocument;
        const employmentType = employee.employeeEmployInfo?.employmentType ?? 'full-time';
        return {
            employee,
            monthly,
            employmentType,
            birthDate: toFormDate(employee.employeePersonalInfo?.birthDate),
        };
    }

    private async loadMonthlyDocument(
        tid: string,
        eid: string,
        yyyyMm: string,
    ): Promise<MonthlyDocument | null> {
        const snap = await getDoc(
            doc(
                this.firestore,
                'tenants',
                tid,
                'monthly-records',
                yyyyMm,
                'employees',
                eid,
            ),
        );
        if (!snap.exists()) return null;
        return snap.data() as MonthlyDocument;
    }
}
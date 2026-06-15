import { Timestamp } from "@angular/fire/firestore";
import { StandardRemunerationSource } from "./social-insurance/monthly/social-insurance-document";

export interface PaymentDocument {
    uid: string;
    displayName: string;

    paymentBaseDays: number;

    payrollData: PayrollData;
    premiumData?: PremiumData;
    calculationSnapshot?: CalculationSnapshot;

    updatedAt: Timestamp;
}

export interface CalculationSnapshot {
    rateId: string;
    effectiveFrom: string;
    rates: { health: number; care: number; pension: number };
    employeeRate: {
        health: number;
        care: number;
        pension: number;
    }
    roundingBy: {
        health: number;
        care: number;
        pension: number;
    };
    healthGrade: number;
    pensionGrade: number;
    standardRemuneration: { health: number; pension: number };
    remuneration?: number;
    source: StandardRemunerationSource;
    calculatedAt: Timestamp;
}

export interface PaymentFormData {
    displayName: string;
    employeeId: string;
    paymentBaseDays: number;
    basicSalary: number;
    fringeBenefits: number;
    allowances: AllowanceData;
    retroactivePay: number | null;
}

export type WageCategory = 'fixed' | 'variable';

export interface PayrollData {
    basicSalary: number;
    fringeBenefits: number;
    fixedWage: number | null;
    variableWage: number | null;
    allowances: AllowanceData;
    retroactivePay: number | null;
}

export interface AllowanceTypeDefinition {
    label: string;
    type: string;
    wageCategory: WageCategory;
}

export type AllowanceTypeMap = Record<string, number>;

export interface AllowanceData {
    [allowanceType: string]: number;
}

export const DEFAULT_ALLOWANCE_TYPE_DEFINITIONS: readonly AllowanceTypeDefinition[] = [
    { label: '時間外手当', type: 'overtime-allowance', wageCategory: 'variable' },
    { label: '通勤手当', type: 'commuting-allowance', wageCategory: 'fixed' },
    { label: '住宅手当', type: 'housing-allowance', wageCategory: 'fixed' },
    { label: '家族手当', type: 'family-allowance', wageCategory: 'fixed' },
    { label: '子ども手当', type: 'child-allowance', wageCategory: 'fixed' },
    { label: '休日手当', type: 'holiday-allowance', wageCategory: 'variable' },
    { label: '深夜手当', type: 'night-allowance', wageCategory: 'variable' },
    { label: '役員手当', type: 'executive-allowance', wageCategory: 'fixed' },
    { label: 'その他', type: 'other-allowance', wageCategory: 'variable' },
] as const;

export interface PremiumData {
    healthInsurance: {
        employer: number;
        employee: number;
    };
    careInsurance: {
        employer: number | null;
        employee: number | null;
    };
    pensionInsurance: {
        employer: number;
        employee: number;
    };
}

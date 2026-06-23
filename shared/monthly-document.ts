import type { FirestoreTimestamp } from './firestore-types';
import { StandardRemunerationSource } from "./social-insurance/monthly/social-insurance-document";
import { AllowanceData } from "./payment-document";

/** tenants/{tid}/monthly-records/{yyyyMm} の報酬期間メタ */
export interface MonthlyPeriodDocument {
    yyyyMm: string;
    locked: boolean;
    lockedAt?: FirestoreTimestamp;
    updatedAt: FirestoreTimestamp;
}

export interface MonthlyDocument {
    uid: string;
    displayName: string;

    paymentBaseDays: number;
    bonusRelatedRemuneration?: number;

    payrollData: PayrollData;
    premiumData?: PremiumData;
    resignBulkPremiumData?: PremiumData;
    calculationSnapshot?: CalculationSnapshot;

    updatedAt: FirestoreTimestamp;
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
    roundingBoundaryType?: 'lessThan' | 'lessThanOrEqual';
    healthGrade: number;
    pensionGrade: number;
    standardRemuneration: { health: number; pension: number };
    remuneration?: number;
    source: StandardRemunerationSource;
    calculatedAt: FirestoreTimestamp;
}

export interface MonthlyFormData {
    displayName: string;
    employeeId: string;
    paymentBaseDays: number;
    basicSalary: number;
    fringeBenefits: number;
    bonusRelatedRemuneration: number;
    allowances: AllowanceData;
    retroactivePay: number | null;
}

export interface PayrollData {
    basicSalary: number;
    fringeBenefits: number;
    fixedWage: number | null;
    variableWage: number | null;
    allowances: AllowanceData;
    retroactivePay: number | null;
}

export interface PremiumData {
    healthInsurance: {
        total: number | null;
        employee: number | null;
    };
    careInsurance: {
        total: number | null;
        employee: number | null;
    };
    pensionInsurance: {
        total: number | null;
        employee: number | null;
    };
}

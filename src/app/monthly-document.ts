import { Timestamp } from "@angular/fire/firestore";
import { StandardRemunerationSource } from "./social-insurance/monthly/social-insurance-document";
import { AllowanceData } from "./payment-document";

/** tenants/{tid}/monthly-records/{yyyyMm} の報酬期間メタ */
export interface MonthlyPeriodDocument {
    yyyyMm: string;
    locked: boolean;
    lockedAt?: Timestamp;
    updatedAt: Timestamp;
}

export interface MonthlyDocument {
    uid: string;
    displayName: string;

    paymentBaseDays: number;
    /** 標準報酬月額の算定に加算する賞与分（定時決定時に12等分値で更新、それ以外は前月値を継承または手入力） */
    bonusRelatedRemuneration?: number;

    payrollData: PayrollData;
    premiumData?: PremiumData;
    resignBulkPremiumData?: PremiumData;
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
    roundingBoundaryType?: 'lessThan' | 'lessThanOrEqual';
    healthGrade: number;
    pensionGrade: number;
    standardRemuneration: { health: number; pension: number };
    remuneration?: number;
    source: StandardRemunerationSource;
    calculatedAt: Timestamp;
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

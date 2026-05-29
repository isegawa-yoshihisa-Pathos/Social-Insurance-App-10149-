import { Timestamp } from "@angular/fire/firestore";

export interface MonthlyDocument {
    uid: string;
    displayName: string;

    payrollData: PayrollData;
    bonusData?: BonusData;
    // premiumData: PremiumData;

    updatedAt: Timestamp;
}

export interface MonthlyFormData {
    displayName: string;
    totalPay: number;
    basicSalary: number;
    overtimePay: number | null;
    commuterAllowance: number | null;
    otherAllowance: number | null;
    retroactivePay: number | null;
    bonus: BonusAmountMap;
    // healthInsurance_employer: number;
    // healthInsurance_employee: number;
    // careInsurance_employer: number | null;
    // careInsurance_employee: number | null;
    // pensionInsurance_employer: number;
    // pensionInsurance_employee: number;
}

export interface PayrollData {
    totalPay: number;
    basicSalary: number;
    overtimePay: number | null;
    commuterAllowance: number | null;
    otherAllowance: number | null;
    retroactivePay: number | null;
}

export interface BonusTypeDefinition {
    label: string;
    type: string;
}

export type BonusAmountMap = Record<string, number>;

export interface BonusData {
    total: number;
    [bonusType: string]: number;
}

export const DEFAULT_BONUS_TYPE_DEFINITIONS: readonly BonusTypeDefinition[] = [
    { label: '定期賞与', type: 'bonus-1' },
    { label: '期末賞与', type: 'bonus-2' },
    { label: 'インセンティブ', type: 'bonus-3' },
    { label: '臨時手当', type: 'bonus-4' },
    { label: '特別賞与', type: 'bonus-5' },
    { label: 'その他', type: 'bonus-6' },
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

import { Timestamp } from "@angular/fire/firestore";

export interface MonthlyDocument {
    uid: string;
    displayName: string;

    payrollData: PayrollData;
    bonusData?: BonusData;
    premiumData: PremiumData;

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
    bonus: BonusMap;
    healthInsurance_employer: number;
    healthInsurance_employee: number;
    careInsurance_employer: number | null;
    careInsurance_employee: number | null;
    pensionInsurance_employer: number;
    pensionInsurance_employee: number;
}

export interface PayrollData {
    totalPay: number;
    basicSalary: number;
    overtimePay: number | null;
    commuterAllowance: number | null;
    otherAllowance: number | null;
    retroactivePay: number | null;
}

export interface BonusData {
    bonus: BonusMap;
}

export type StoredBonusType =
    | 'annual'
    | 'term_end'
    | 'incentive'
    | 'allowance'
    | 'special'
    | 'other';

export type BonusType = StoredBonusType | '';

export type BonusMap = Partial<Record<StoredBonusType, number>>;

export const STORED_BONUS_TYPES: readonly StoredBonusType[] = [
    'annual',
    'term_end',
    'incentive',
    'allowance',
    'special',
    'other',
] as const;

export const BONUS_TYPE_LABELS: Record<StoredBonusType, string> = {
    annual: '定期賞与',
    term_end: '期末賞与',
    incentive: 'インセンティブ',
    allowance: '臨時手当',
    special: '特別賞与',
    other: 'その他',
};

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
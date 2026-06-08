import { Timestamp } from "@angular/fire/firestore";
import { StandardBonusSource } from "./social-insurance/bonus/social-insurance-document";

export interface BonusDocument {
    uid: string;
    displayName: string;
    bonusData?: BonusData;
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
    standardBonus: { health: number; pension: number };
    bonusAmount: number;
    rawStandardBonus: number;
    source: StandardBonusSource;
    calculatedAt: Timestamp;
}

export interface BonusFormData {
    displayName: string;
    employeeId: string;
    bonus: BonusAmountMap;
}

export interface BonusTypeDefinition {
    label: string;
    type: string;
    bonusFrequency: BonusFrequency;
}
export type BonusFrequency = 'high' | 'low';

export type BonusAmountMap = Record<string, number>;

export interface BonusData {
    total: number;
    [bonusType: string]: number;
}

export const DEFAULT_BONUS_TYPE_DEFINITIONS: readonly BonusTypeDefinition[] = [
    { label: '定期賞与', type: 'annual-bonus', bonusFrequency: 'low' },
    { label: '期末賞与', type: 'period-bonus', bonusFrequency: 'low' },
    { label: 'インセンティブ', type: 'incentive-bonus', bonusFrequency: 'low' },
    { label: '臨時手当', type: 'temporary-allowance', bonusFrequency: 'low' },
    { label: '特別賞与', type: 'special-bonus', bonusFrequency: 'low' },
    { label: 'その他', type: 'other-bonus', bonusFrequency: 'low' },
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

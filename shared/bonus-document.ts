import type { FirestoreTimestamp } from './firestore-types';
import { StandardBonusSource } from "./social-insurance/bonus/social-insurance-document";

export interface BonusDocument {
    uid: string;
    displayName: string;
    bonusData?: BonusData;
    premiumData?: PremiumData;
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
    standardBonus: { health: number; pension: number };
    bonusAmount: number;
    rawStandardBonus: number;
    source: StandardBonusSource;
    calculatedAt: FirestoreTimestamp;
}

export interface BonusFormData {
    displayName: string;
    employeeId: string;
    bonus: BonusAmountMap;
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

import { Timestamp } from "@angular/fire/firestore";
import { StandardBonusSource } from "./social-insurance/bonus/social-insurance-document";

/** tenants/{tid}/bonus-records/{yyyyMm} の賞与期間メタ */
export interface BonusPeriodDocument {
    yyyyMm: string;
    locked: boolean;
    lockedAt?: Timestamp;
    updatedAt: Timestamp;
}

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
    roundingBoundaryType?: 'lessThan' | 'lessThanOrEqual';
    standardBonus: { health: number; pension: number };
    bonusAmount: number;
    rawStandardBonus: number;
    source: StandardBonusSource;
    skipReason?: string;
    calculatedAt: Timestamp;
}

export interface BonusFormData {
    displayName: string;
    employeeId: string;
}

export interface BonusTypeDefinition {
    label: string;
    type: string;
    bonusFrequency: BonusFrequency;
    target: BonusTarget;
}
export type BonusFrequency = 'high' | 'low';
export type BonusTarget = 'labor' | 'non-labor';

export type BonusAmountMap = Record<string, number>;

export interface BonusData {
    [bonusType: string]: number;
}

export const DEFAULT_BONUS_TYPE_DEFINITIONS: readonly BonusTypeDefinition[] = [
    { label: '定期賞与', type: 'annual-bonus', bonusFrequency: 'low', target: 'labor' },
    { label: '期末賞与', type: 'period-bonus', bonusFrequency: 'low', target: 'labor' },
    { label: 'インセンティブ', type: 'incentive-bonus', bonusFrequency: 'low', target: 'labor' },
    { label: '臨時賞与', type: 'temporary-bonus', bonusFrequency: 'low', target: 'labor' },
    { label: '特別賞与', type: 'special-bonus', bonusFrequency: 'low', target: 'labor' },
    { label: 'その他', type: 'other-bonus', bonusFrequency: 'low', target: 'labor' },
] as const;

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

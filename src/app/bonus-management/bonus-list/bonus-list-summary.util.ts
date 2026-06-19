import type { BonusListRow } from './bonus-list-columns';
import {
  aggregateBonusEmployerPremium,
  type BonusPremiumInput,
  type EmployerBurdenRoundingSettings,
} from '../../../../shared/payment-summary.util';

export function toBonusPremiumInput(row: BonusListRow): BonusPremiumInput {
  return {
    bonus: row.bonus,
    bonusHealthInsuranceEmployee: row.healthInsuranceEmployee,
    bonusCareInsuranceEmployee: row.careInsuranceEmployee,
    bonusPensionInsuranceEmployee: row.pensionInsuranceEmployee,
    bonusHealthInsuranceTotal: row.healthInsuranceTotal,
    bonusCareInsuranceTotal: row.careInsuranceTotal,
    bonusPensionInsuranceTotal: row.pensionInsuranceTotal,
  };
}

export function bonusListEmployerBurden(
  rows: readonly BonusListRow[],
  settings: EmployerBurdenRoundingSettings,
): number {
  return aggregateBonusEmployerPremium(rows.map((row) => toBonusPremiumInput(row)), settings);
}

export type { EmployerBurdenRoundingSettings };

import type { EmployeeRateByInsurance, InsuranceRateSavePayload, RoundingByInsurance } from '../../monthly/social-insurance-document';
import { resolveCombinationRates, findCombinationRegistry } from './lookup';
import type { CombinationRegistryEntry } from './types';
import { normalizeRoundingBy } from '../../monthly/social-insurance-document';
import { roundRate } from '../../premium/rounding';
import { resolveAssociationRates } from '../association/lookup';
import type { AssociationRateTableSet } from '../association/types';

export function buildCombinationInsuranceRatePayload(
  registries: readonly CombinationRegistryEntry[],
  combinationCode: string,
  targetDate: string,
  options?: {
    employeeRate?: EmployeeRateByInsurance;
    roundingBy?: RoundingByInsurance;
  },
): InsuranceRateSavePayload | null {
  const registry = findCombinationRegistry(registries, combinationCode);
  if (!registry) return null;

  const resolved = resolveCombinationRates(registry, targetDate);
  if (!resolved) return null;

  return {
    effectiveFrom: resolved.effectiveFrom,
    label: `${resolved.label} ${resolved.combinationName}`,
    rateSource: 'combination_import',
    healthInsuranceRate: resolved.healthInsuranceRate,
    careInsuranceRate: resolved.careInsuranceRate,
    pensionInsuranceRate: resolved.pensionInsuranceRate,
    employeeRate: {
      healthInsurance: options?.employeeRate?.healthInsurance ?? roundRate(resolved.healthInsuranceRate / 2),
      careInsurance: options?.employeeRate?.careInsurance ?? roundRate(resolved.careInsuranceRate / 2),
      pensionInsurance: options?.employeeRate?.pensionInsurance ?? roundRate(resolved.pensionInsuranceRate / 2),
    },
    roundingBy: normalizeRoundingBy(options?.roundingBy),
  };
}

export function buildOtherCombinationInsuranceRatePayload(
  combinationName: string,
  table: AssociationRateTableSet,
  options?: {
    employeeRate?: EmployeeRateByInsurance;
    roundingBy?: RoundingByInsurance;
  },
): InsuranceRateSavePayload | null {
  const resolved = resolveAssociationRates(table, '13');
  if (!resolved) return null;
  return {
    effectiveFrom: resolved.effectiveFrom,
    label: `${resolved.label.replace('協会けんぽ', '').trim()} ${combinationName}`,
    rateSource: 'combination_import',
    healthInsuranceRate: resolved.healthInsuranceRate,
    careInsuranceRate: resolved.careInsuranceRate,
    pensionInsuranceRate: resolved.pensionInsuranceRate,
    employeeRate: {
      healthInsurance: options?.employeeRate?.healthInsurance ?? roundRate(resolved.healthInsuranceRate / 2),
      careInsurance: options?.employeeRate?.careInsurance ?? roundRate(resolved.careInsuranceRate / 2),
      pensionInsurance: options?.employeeRate?.pensionInsurance ?? roundRate(resolved.pensionInsuranceRate / 2),
    },
    roundingBy: normalizeRoundingBy(options?.roundingBy),
  };
}
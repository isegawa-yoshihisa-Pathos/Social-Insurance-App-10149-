export interface CombinationRateTableSet {
  combinationName: string;
  effectiveFrom: string;
  label: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
}

export interface CombinationRegistryEntry {
  combinationName: string;
  tables: readonly CombinationRateTableSet[];
}

export interface ResolvedCombinationRates {
  combinationName: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  childSupportRate?: number;
  effectiveFrom: string;
  label: string;
}
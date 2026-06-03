export interface CombinationRateTableSet {
  combinationCode: string;
  combinationName: string;
  effectiveFrom: string;
  label: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
}

export interface CombinationRegistryEntry {
  combinationCode: string;
  combinationName: string;
  tables: readonly CombinationRateTableSet[];
}

export interface ResolvedCombinationRates {
  combinationCode: string;
  combinationName: string;
  healthInsuranceRate: number;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  childSupportRate?: number;
  effectiveFrom: string;
  label: string;
}
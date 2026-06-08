export type PrefectureCode = string;

export interface AssociationPrefectureRateRow {
  prefectureCode: PrefectureCode;
  prefectureName: string;
  healthInsuranceRate: number;
}

export interface AssociationRateTableSet {
  effectiveFrom: string;
  label: string;
  careInsuranceRate: number;
  pensionInsuranceRate: number;
  prefectures: readonly AssociationPrefectureRateRow[];
}
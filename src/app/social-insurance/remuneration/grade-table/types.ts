/** 1等級分（協会けんぽ50 / 厚年32 のどちらかの表の1行） */
export interface RemunerationGradeRow {
    grade: number;
    minRemuneration: number;
    maxRemuneration: number;
    standardRemuneration: number;
  }
  
/** 法改正ごとに差し替える一式 */
  export interface RemunerationGradeTableSet {
    effectiveFrom: string;
    label: string;
    health: readonly RemunerationGradeRow[];
    pension: readonly RemunerationGradeRow[];
  }
  
/** 照合結果 */
  export interface GradeLookupResult {
    grade: number;
    standardRemuneration: number;
    minRemuneration: number;
    maxRemuneration: number;
  }
  
/** 報酬月額1回分の照合結果（保険料・履歴保存用） */
  export interface ResolvedStandardRemuneration {
    remuneration: number;
    health: GradeLookupResult;
    pension: GradeLookupResult;
  }
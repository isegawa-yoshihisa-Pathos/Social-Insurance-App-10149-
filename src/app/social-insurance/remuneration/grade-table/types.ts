/** 1等級分（協会けんぽ50 / 厚年32 のどちらかの表の1行） */
export interface RemunerationGradeRow {
    grade: number;
    minRemuneration: number;
    maxRemuneration: number;
    standardRemuneration: number;
  }
  
  export interface RemunerationGradeTableSet {
    effectiveFrom: string;
    label: string;
    health: readonly RemunerationGradeRow[];
    pension: readonly RemunerationGradeRow[];
  }
  
  export interface GradeLookupResult {
    grade: number;
    standardRemuneration: number;
    minRemuneration: number;
    maxRemuneration: number;
  }
  
  export interface ResolvedStandardRemuneration {
    remuneration: number;
    health: GradeLookupResult;
    pension: GradeLookupResult;
  }
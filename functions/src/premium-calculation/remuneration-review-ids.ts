export function teijiAnnualAverageReviewId(eid: string, teijiYear: number): string {
  return `teiji_aa_${eid}_${teijiYear}`;
}

export function zuijiAnnualAverageReviewId(eid: string, changeMonthYyyyMm: string): string {
  return `zuiji_aa_${eid}_${changeMonthYyyyMm}`;
}

export function leaveReturnReviewId(eid: string, leaveEndYyyyMm: string): string {
  return `leave_return_${eid}_${leaveEndYyyyMm}`;
}

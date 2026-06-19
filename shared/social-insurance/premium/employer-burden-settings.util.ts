import type { ResolvedInsuranceRate } from '../monthly/social-insurance-document';
import type { EmployerBurdenRoundingSettings } from './employer-premium-aggregate';

export function toEmployerBurdenRoundingSettings(
  rate: ResolvedInsuranceRate | null | undefined,
): EmployerBurdenRoundingSettings | null {
  if (!rate) {
    return null;
  }

  return {
    roundingBy: rate.roundingBy,
    roundingBoundaryType: rate.roundingBoundaryType,
  };
}

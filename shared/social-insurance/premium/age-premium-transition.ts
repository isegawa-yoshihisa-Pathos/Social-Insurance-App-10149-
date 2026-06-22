import { addMonths } from '../monthly/social-insurance-data.util';
import {
  hasCareInsuranceAgeDependent,
  isCareInsuranceTarget,
  isHealthInsuranceTarget,
  isInsurancePeriodTarget,
  isPensionInsuranceTarget,
  isSpecificInsuranceCollectionEnabled,
  type CareInsuranceCollectionInput,
} from './premium-calculator';

export type AgePremiumTransitionKind =
  | 'care_insurance_collection_start'
  | 'care_insurance_collection_end'
  | 'specific_care_insurance_collection_start'
  | 'specific_care_insurance_collection_end'
  | 'health_insurance_end'
  | 'pension_insurance_end';

export interface AgePremiumTransition {
  kind: AgePremiumTransitionKind;
  yyyyMm: string;
}

export interface DetectAgePremiumTransitionsInput extends CareInsuranceCollectionInput {
  yyyyMm: string;
  birthDate: Date | null;
  licenceStartAt: Date | null | undefined;
  resignAt: Date | null | undefined;
  licenseEndAt?: Date | null | undefined;
}

function employeeCareCollectionForMonth(
  birthDate: Date | null,
  yyyyMm: string,
): boolean {
  return isCareInsuranceTarget(birthDate, yyyyMm);
}

function specificCareCollectionForMonth(
  input: DetectAgePremiumTransitionsInput,
  yyyyMm: string,
): boolean {
  if (!isSpecificInsuranceCollectionEnabled(input.specificInsuranceCollectionType)) {
    return false;
  }
  return hasCareInsuranceAgeDependent(
    input.dependentsInfo,
    yyyyMm,
    input.hasDependents,
  );
}

export function detectAgePremiumTransitions(
  input: DetectAgePremiumTransitionsInput,
): AgePremiumTransition[] {
  if (
    !isInsurancePeriodTarget(
      input.licenceStartAt,
      input.resignAt,
      input.yyyyMm,
      input.licenseEndAt,
    )
  ) {
    return [];
  }

  const prevYyyyMm = addMonths(input.yyyyMm, -1);
  const prevInInsurancePeriod = isInsurancePeriodTarget(
    input.licenceStartAt,
    input.resignAt,
    prevYyyyMm,
    input.licenseEndAt,
  );

  const transitions: AgePremiumTransition[] = [];

  if (input.birthDate) {
    const employeeCareNow = employeeCareCollectionForMonth(
      input.birthDate,
      input.yyyyMm,
    );
    const employeeCarePrev = prevInInsurancePeriod
      ? employeeCareCollectionForMonth(input.birthDate, prevYyyyMm)
      : false;

    if (!employeeCarePrev && employeeCareNow) {
      transitions.push({
        kind: 'care_insurance_collection_start',
        yyyyMm: input.yyyyMm,
      });
    }
    if (employeeCarePrev && !employeeCareNow) {
      transitions.push({
        kind: 'care_insurance_collection_end',
        yyyyMm: input.yyyyMm,
      });
    }

    const healthNow = isHealthInsuranceTarget(input.birthDate, input.yyyyMm);
    const healthPrev =
      prevInInsurancePeriod &&
      isHealthInsuranceTarget(input.birthDate, prevYyyyMm);
    if (healthPrev && !healthNow) {
      transitions.push({
        kind: 'health_insurance_end',
        yyyyMm: input.yyyyMm,
      });
    }

    const pensionNow = isPensionInsuranceTarget(input.birthDate, input.yyyyMm);
    const pensionPrev =
      prevInInsurancePeriod &&
      isPensionInsuranceTarget(input.birthDate, prevYyyyMm);
    if (pensionPrev && !pensionNow) {
      transitions.push({
        kind: 'pension_insurance_end',
        yyyyMm: input.yyyyMm,
      });
    }
  }

  const specificCareNow = specificCareCollectionForMonth(input, input.yyyyMm);
  const specificCarePrev = prevInInsurancePeriod
    ? specificCareCollectionForMonth(input, prevYyyyMm)
    : false;

  if (!specificCarePrev && specificCareNow) {
    transitions.push({
      kind: 'specific_care_insurance_collection_start',
      yyyyMm: input.yyyyMm,
    });
  }
  if (specificCarePrev && !specificCareNow) {
    transitions.push({
      kind: 'specific_care_insurance_collection_end',
      yyyyMm: input.yyyyMm,
    });
  }

  return transitions;
}

import type { ApplicationDocument } from '../../../shared/application-document';
import {
  buildEmployeePersonalInfoSavePayload,
  buildSingleAffiliationPersonalInfoSavePayload,
  personalFormToSavePayload,
  type EmployeeFormData,
  type PersonalFormData,
} from '../personal-form-data';

type PersonalInfoApplicationDetails = NonNullable<ApplicationDocument['personalInfoDetails']>;

export function buildPersonalInfoApplicationDetails(
  personal: PersonalFormData,
  employee: EmployeeFormData,
  multipleAffiliations: boolean,
): PersonalInfoApplicationDetails {
  return {
    multipleAffiliations,
    accountPersonalInfo: multipleAffiliations
      ? personalFormToSavePayload(personal)
      : buildSingleAffiliationPersonalInfoSavePayload(personal, employee),
    employeePersonalInfo: buildEmployeePersonalInfoSavePayload(personal, employee),
    affiliationDisplayName: employee.displayName.trim(),
  };
}

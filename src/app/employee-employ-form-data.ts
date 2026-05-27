import { EmployeeDocument, EmployeeEmployFormData, EmployeeEmployInfo } from './employee-document';
import { formatJapaneseDate, toFirestoreTimestamp, toFormDate } from './date-utils';

export function createEmptyEmployForm(): EmployeeEmployFormData {
  return {
    position: '',
    department: '',
    payType: '',
    employmentType: '',
    status: 'active',
    joinedAt: null,
    leaveAt: null,
    returnAt: null,
    resignAt: null,
    licenseStartAt: null,
    licenseEndAt: null,
    healthInsuranceRecordNumber: '',
    pensionInsuranceRecordNumber: '',
  };
}

const EMPLOY_DATE_FIELDS = [
  'joinedAt',
  'leaveAt',
  'returnAt',
  'resignAt',
  'licenseStartAt',
  'licenseEndAt',
] as const;

export function employeeEmployInfoToForm(
  doc?: Partial<EmployeeDocument> & Record<string, unknown>,
): EmployeeEmployFormData {
  const nested = doc?.employeeEmployInfo as Partial<EmployeeEmployInfo> | undefined;
  const legacy = doc as Partial<EmployeeEmployInfo> | undefined;
  const source = nested ?? legacy;

  const form: EmployeeEmployFormData = {
    ...createEmptyEmployForm(),
    position: source?.position ?? '',
    department: source?.department ?? '',
    payType: source?.payType ?? '',
    employmentType: source?.employmentType ?? '',
    status: source?.status ?? 'active',
    healthInsuranceRecordNumber: source?.healthInsuranceRecordNumber ?? '',
    pensionInsuranceRecordNumber: source?.pensionInsuranceRecordNumber ?? '',
    joinedAt: null,
    leaveAt: null,
    returnAt: null,
    resignAt: null,
    licenseStartAt: null,
    licenseEndAt: null,
  };

  for (const field of EMPLOY_DATE_FIELDS) {
    form[field] = toFormDate(source?.[field]);
  }

  return form;
}

export function employFormToSavePayload(
  form: EmployeeEmployFormData,
): Pick<EmployeeDocument, 'employeeEmployInfo'> {
  const employeeEmployInfo: EmployeeEmployInfo = {
    position: form.position,
    department: form.department,
    payType: form.payType,
    employmentType: form.employmentType,
    status: form.status,
    joinedAt: toFirestoreTimestamp(form.joinedAt),
    leaveAt: toFirestoreTimestamp(form.leaveAt),
    returnAt: toFirestoreTimestamp(form.returnAt),
    resignAt: toFirestoreTimestamp(form.resignAt),
    licenseStartAt: toFirestoreTimestamp(form.licenseStartAt),
    licenseEndAt: toFirestoreTimestamp(form.licenseEndAt),
    healthInsuranceRecordNumber: form.healthInsuranceRecordNumber,
    pensionInsuranceRecordNumber: form.pensionInsuranceRecordNumber,
  };

  return { employeeEmployInfo };
}

export { formatJapaneseDate };

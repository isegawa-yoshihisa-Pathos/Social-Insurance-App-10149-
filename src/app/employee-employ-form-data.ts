import { EmployeeEmployFormData, EmployeeEmployInfo } from './employee-document';
import { formatJapaneseDate, toFirestoreTimestamp, toFormDate } from './date-utils';

export function createEmptyEmployForm(): EmployeeEmployFormData {
  return {
    employeeId: '',
    position: '',
    department: '',
    payType: '',
    employmentType: 'full-time',
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
  info?: Partial<EmployeeEmployInfo>,
): EmployeeEmployFormData {
  const form: EmployeeEmployFormData = {
    ...createEmptyEmployForm(),
    employeeId: info?.employeeId ?? '',
    position: info?.position ?? '',
    department: info?.department ?? '',
    payType: info?.payType ?? '',
    employmentType: info?.employmentType ?? 'full-time',
    status: info?.status ?? 'active',
    healthInsuranceRecordNumber: info?.healthInsuranceRecordNumber ?? '',
    pensionInsuranceRecordNumber: info?.pensionInsuranceRecordNumber ?? '',
    joinedAt: null,
    leaveAt: null,
    returnAt: null,
    resignAt: null,
    licenseStartAt: null,
    licenseEndAt: null,
  };

  for (const field of EMPLOY_DATE_FIELDS) {
    form[field] = toFormDate(info?.[field]);
  }

  return form;
}

export function employFormToSavePayload(
  form: EmployeeEmployFormData,
): { employeeEmployInfo: EmployeeEmployInfo } {
  const employeeEmployInfo: EmployeeEmployInfo = {
    employeeId: form.employeeId,
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

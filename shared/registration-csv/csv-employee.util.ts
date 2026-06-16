import type { RegistrationFilingEmployeeSnapshot } from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import { toWarekiYymmdd, toWarekiYearMonth } from './wareki';
import { resolveOfficeSymbolParts } from './office-block';
import {
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  splitBasicPensionNumber,
} from './csv-record.util';
import type { RegistrationFilingTenantSnapshot } from '../registration-filing-document';

export function birthWarekiFromEmployee(employee: RegistrationFilingEmployeeSnapshot) {
  const date = employee.birthDate ? toFormDate(employee.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return toWarekiYymmdd(date) ?? { era: '', yymmdd: '' };
}

export function birthWarekiFromDateString(dateString: string | null | undefined) {
  const date = dateString ? toFormDate(dateString) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return toWarekiYymmdd(date) ?? { era: '', yymmdd: '' };
}

export function warekiFromYyyyMmDd(dateString: string | null | undefined) {
  return birthWarekiFromDateString(dateString);
}

export function warekiYearMonthFromYyyyMm(yyyyMm: string | null | undefined) {
  if (!yyyyMm) {
    return { era: '', year: '', month: '' };
  }
  return toWarekiYearMonth(yyyyMm.slice(0, 7)) ?? { era: '', year: '', month: '' };
}

export function officeNumber(tenant: RegistrationFilingTenantSnapshot): string {
  const settings = tenant.socialInsuranceSettings ?? {};
  return String(settings['pensionInsuranceTenantNumber'] ?? '');
}

export function officeBlockFields(tenant: RegistrationFilingTenantSnapshot): string[] {
  const office = resolveOfficeSymbolParts(tenant);
  return [office.prefectureCode, office.districtCode, office.officeSymbol];
}

export function employeeRecordNumber(employee: RegistrationFilingEmployeeSnapshot): string {
  return employee.healthInsuranceRecordNumber || employee.pensionInsuranceRecordNumber;
}

export function employeeNameFields(employee: RegistrationFilingEmployeeSnapshot): string[] {
  return [formatEmployeeKanaName(employee.realName), formatEmployeeKanjiName(employee.realName)];
}

export function employeeBirthFields(employee: RegistrationFilingEmployeeSnapshot): string[] {
  const birth = birthWarekiFromEmployee(employee);
  return [birth.era, birth.yymmdd];
}

export function employeePensionFields(employee: RegistrationFilingEmployeeSnapshot): string[] {
  const pension = splitBasicPensionNumber(employee.basicPensionNumber);
  return [pension.office, pension.serial];
}

export function formatOfficeAddressFromEmployee(_employee: RegistrationFilingEmployeeSnapshot): string {
  return '';
}

export function shortTimeFlag(employmentType: string): string {
  return employmentType === 'short-time-labor' || employmentType === 'short-time-worker'
    ? '1'
    : '';
}

export function fixedFields(length: number, fill = ''): string[] {
  return Array.from({ length }, () => fill);
}

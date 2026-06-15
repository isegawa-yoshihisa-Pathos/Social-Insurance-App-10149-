import type {
  RegistrationCsvFormType,
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingSavePayload,
  RegistrationFilingTenantSnapshot,
  RegistrationStandardBonusPayload,
  RegistrationStandardRemunerationPayload,
} from '../registration-filing-document';
import {
  formatOfficeAddress,
  formatOwnerFullName,
  resolveOfficeSymbolParts,
  splitZipcode,
} from './office-block';
import { joinCsvRecord } from './csv-record.util';
import { buildTeijiSanteiDataRecord } from './teiji-santei-csv';
import { buildMonthlyChangeDataRecord } from './monthly-change-csv';
import { buildBonusPaymentDataRecord } from './bonus-payment-csv';

function formatTodayYyyymmdd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildMediaRecord(tenant: RegistrationFilingTenantSnapshot, mediaSerial: string): string {
  const office = resolveOfficeSymbolParts(tenant);
  return joinCsvRecord([
    office.prefectureCode,
    office.districtCode,
    office.officeSymbol,
    mediaSerial,
    formatTodayYyyymmdd(),
    '22223',
  ]);
}

function buildOfficeCountRecord(): string {
  return joinCsvRecord(['', '001']);
}

function buildOfficeRecord(tenant: RegistrationFilingTenantSnapshot): string {
  const office = resolveOfficeSymbolParts(tenant);
  const zip = splitZipcode(tenant.zipcode);
  const settings = tenant.socialInsuranceSettings ?? {};
  return joinCsvRecord([
    office.prefectureCode,
    office.districtCode,
    office.officeSymbol,
    String(settings['pensionInsuranceTenantNumber'] ?? ''),
    zip.parent,
    zip.child,
    formatOfficeAddress(tenant),
    tenant.tenantName,
    formatOwnerFullName(tenant),
    tenant.phoneNumber.tel1,
    tenant.phoneNumber.tel2,
    tenant.phoneNumber.tel3,
  ]);
}

function buildDataRecord(
  formType: RegistrationCsvFormType,
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  formPayload: Record<string, unknown>,
): string {
  switch (formType) {
    case 'teiji_santei':
      return buildTeijiSanteiDataRecord(
        tenant,
        employee,
        formPayload as unknown as RegistrationStandardRemunerationPayload,
      );
    case 'monthly_change':
      return buildMonthlyChangeDataRecord(
        tenant,
        employee,
        formPayload as unknown as RegistrationStandardRemunerationPayload,
      );
    case 'bonus_payment':
      return buildBonusPaymentDataRecord(
        tenant,
        employee,
        formPayload as unknown as RegistrationStandardBonusPayload,
      );
  }
}

export function buildRegistrationCsvFile(
  formType: RegistrationCsvFormType,
  filings: RegistrationFilingSavePayload[],
): string {
  if (filings.length === 0) {
    return '';
  }

  const tenant = filings[0].tenantSnapshot;
  const lines = [
    buildMediaRecord(tenant, '001'),
    buildOfficeCountRecord(),
    buildOfficeRecord(tenant),
  ];

  for (const filing of filings) {
    const employee = filing.employees[0];
    if (!employee) {
      continue;
    }
    lines.push(buildDataRecord(formType, tenant, employee, filing.formPayload));
  }

  return lines.join('\n');
}

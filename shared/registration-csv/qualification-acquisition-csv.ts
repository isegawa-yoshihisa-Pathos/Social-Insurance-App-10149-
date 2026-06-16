import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationQualificationAcquisitionPayload,
} from '../registration-filing-document';
import {
  employeeBirthFields,
  employeeNameFields,
  employeePensionFields,
  officeBlockFields,
  officeNumber,
  shortTimeFlag,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import { formatAmountField, joinCsvRecord } from './csv-record.util';

const FORM_CODE = '2200700';

export function buildQualificationAcquisitionDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationQualificationAcquisitionPayload,
): string {
  const acquisition = warekiFromYyyyMmDd(payload.acquisitionDate);
  const currency = payload.currencyAmount ?? 0;
  const inKind = payload.inKindAmount ?? 0;
  const total = payload.totalAmount ?? currency + inKind;

  const fields: (string | number)[] = [
    FORM_CODE,
    ...officeBlockFields(tenant),
    officeNumber(tenant),
    '',
    ...employeeNameFields(employee),
    ...employeeBirthFields(employee),
    '',
    '1',
    employee.myNumber,
    '',
    '',
    ...employeePensionFields(employee),
    acquisition.era,
    acquisition.yymmdd,
    payload.hasDependents ? '1' : '0',
    formatAmountField(currency),
    formatAmountField(inKind),
    formatAmountField(total),
    '',
    '',
    shortTimeFlag(employee.employmentType),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  return joinCsvRecord(fields);
}

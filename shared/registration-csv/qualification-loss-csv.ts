import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationQualificationLossPayload,
} from '../registration-filing-document';
import {
  employeeBirthFields,
  employeeNameFields,
  employeePensionFields,
  employeeRecordNumber,
  officeBlockFields,
  officeNumber,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import { joinCsvRecord } from './csv-record.util';

const FORM_CODE = '2201700';

export function buildQualificationLossDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationQualificationLossPayload,
): string {
  const loss = warekiFromYyyyMmDd(payload.lossDate);
  const resign = warekiFromYyyyMmDd(payload.resignDate ?? payload.lossDate);

  const fields: (string | number)[] = [
    FORM_CODE,
    ...officeBlockFields(tenant),
    officeNumber(tenant),
    employeeRecordNumber(employee),
    ...employeeNameFields(employee),
    ...employeeBirthFields(employee),
    employee.myNumber,
    ...employeePensionFields(employee),
    loss.era,
    loss.yymmdd,
    payload.lossReason ?? '4',
    resign.era,
    resign.yymmdd,
    '',
    '',
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

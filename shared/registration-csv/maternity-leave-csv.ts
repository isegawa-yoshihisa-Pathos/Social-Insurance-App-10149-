import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationLeavePayload,
} from '../registration-filing-document';
import {
  employeeBirthFields,
  employeeNameFields,
  employeePensionFields,
  employeeRecordNumber,
  officeBlockFields,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import { joinCsvRecord } from './csv-record.util';

const FORM_CODE = '2273700';

export function buildMaternityLeaveDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationLeavePayload,
): string {
  const record = payload.leaveRecords[0];
  const start = warekiFromYyyyMmDd(record?.startAt);
  const end = warekiFromYyyyMmDd(record?.endAt);
  const due = warekiFromYyyyMmDd(payload.expectedDueDate);

  const fields: (string | number)[] = [
    FORM_CODE,
    ...officeBlockFields(tenant),
    employeeRecordNumber(employee),
    ...employeeNameFields(employee),
    employee.myNumber,
    ...employeePensionFields(employee),
    ...employeeBirthFields(employee),
    due.era,
    due.yymmdd,
    payload.multipleBirth ? '1' : '0',
    start.era,
    start.yymmdd,
    end.era,
    end.yymmdd,
    '',
    '',
    '',
    '',
    record?.reason ?? '',
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

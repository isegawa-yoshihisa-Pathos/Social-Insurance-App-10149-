import type { DependentInfo } from '../personal-document';
import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationLeavePayload,
} from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import {
  birthWarekiFromDateString,
  employeeBirthFields,
  employeeNameFields,
  employeePensionFields,
  employeeRecordNumber,
  fixedFields,
  officeBlockFields,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import {
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  joinCsvRecord,
} from './csv-record.util';

const FORM_CODE = '2263700';
const FIELD_COUNT = 56;

function isChildDependent(dependent: DependentInfo): boolean {
  return dependent.relationship !== 'spouse';
}

function dependentBirthWareki(dependent: DependentInfo) {
  const date = dependent.birthDate ? toFormDate(dependent.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return birthWarekiFromDateString(`${y}-${m}-${d}`);
}

export function buildChildcareLeaveDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationLeavePayload,
): string {
  const fields = fixedFields(FIELD_COUNT);
  const record = payload.leaveRecords[0];
  const child = (payload.dependentsInfo ?? []).find(isChildDependent) as DependentInfo | undefined;
  const start = warekiFromYyyyMmDd(record?.startAt);
  const end = warekiFromYyyyMmDd(record?.endAt);
  const childBirth = child ? dependentBirthWareki(child) : { era: '', yymmdd: '' };

  fields[0] = FORM_CODE;
  const office = officeBlockFields(tenant);
  fields[1] = office[0];
  fields[2] = office[1];
  fields[3] = office[2];
  fields[4] = employeeRecordNumber(employee);
  const names = employeeNameFields(employee);
  fields[5] = names[0];
  fields[6] = names[1];
  fields[7] = employee.myNumber;
  const pension = employeePensionFields(employee);
  fields[8] = pension[0];
  fields[9] = pension[1];
  const birth = employeeBirthFields(employee);
  fields[10] = birth[0];
  fields[11] = birth[1];
  fields[12] = '';
  if (child) {
    fields[13] = formatEmployeeKanaName(child.realName);
    fields[14] = formatEmployeeKanjiName(child.realName);
  }
  fields[15] = childBirth.era;
  fields[16] = childBirth.yymmdd;
  fields[17] = '1';
  fields[20] = start.era;
  fields[21] = start.yymmdd;
  fields[22] = end.era;
  fields[23] = end.yymmdd;

  return joinCsvRecord(fields);
}

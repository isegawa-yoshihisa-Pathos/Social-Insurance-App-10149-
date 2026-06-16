import type { DependentInfo } from '../personal-document';
import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationNationalPensionType3Payload,
} from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import {
  birthWarekiFromDateString,
  employeeBirthFields,
  employeeNameFields,
  employeePensionFields,
  fixedFields,
  formatOfficeAddressFromEmployee,
  officeBlockFields,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import {
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  joinCsvRecord,
  splitBasicPensionNumber,
} from './csv-record.util';
import { splitZipcode } from './office-block';

const FORM_CODE = '4300700';
const FIELD_COUNT = 63;

function isSpouse(dependent: DependentInfo): boolean {
  return dependent.relationship === 'spouse';
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

export function buildNationalPensionType3DataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationNationalPensionType3Payload,
): string {
  const fields = fixedFields(FIELD_COUNT);
  const today = warekiFromYyyyMmDd(new Date().toISOString().slice(0, 10));
  const dependents = (payload.dependentsInfo ?? []) as DependentInfo[];
  const spouse = dependents.find(isSpouse);
  const office = officeBlockFields(tenant);
  const employeeBirth = employeeBirthFields(employee);
  const employeePension = employeePensionFields(employee);
  const employeeZip = splitZipcode(employee.zipcode ?? '');
  const employeeNames = employeeNameFields(employee);

  fields[0] = FORM_CODE;
  fields[1] = office[0];
  fields[2] = office[1];
  fields[3] = office[2];
  fields[4] = today.era;
  fields[5] = today.yymmdd;
  fields[6] = employeeNames[0];
  fields[7] = employeeNames[1];
  fields[8] = employeeBirth[0];
  fields[9] = employeeBirth[1];
  fields[10] = '';
  fields[11] = employee.myNumber;
  fields[12] = employeePension[0];
  fields[13] = employeePension[1];
  fields[14] = employeeZip.parent;
  fields[15] = employeeZip.child;
  fields[16] = formatOfficeAddressFromEmployee(employee);

  if (spouse) {
    fields[17] = today.era;
    fields[18] = today.yymmdd;
    fields[19] = formatEmployeeKanaName(spouse.realName);
    fields[20] = formatEmployeeKanjiName(spouse.realName);
    const spouseBirth = dependentBirthWareki(spouse);
    fields[21] = spouseBirth.era;
    fields[22] = spouseBirth.yymmdd;
    fields[23] = '';
    fields[24] = '';
    const spousePension = splitBasicPensionNumber('');
    fields[25] = spousePension.office;
    fields[26] = spousePension.serial;
    fields[30] = '1';
    fields[31] = employeeZip.parent;
    fields[32] = employeeZip.child;
    fields[33] = formatOfficeAddressFromEmployee(employee);
    fields[38] = payload.changeType ?? '1';
    if ((payload.changeType ?? '1') === '1') {
      fields[43] = '31';
    }
  } else {
    fields[38] = payload.changeType ?? '1';
  }

  return joinCsvRecord(fields);
}

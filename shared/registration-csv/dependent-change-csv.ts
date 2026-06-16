import type { DependentInfo } from '../personal-document';
import type {
  RegistrationDependentChangePayload,
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
} from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import {
  birthWarekiFromDateString,
  employeeBirthFields,
  employeeRecordNumber,
  fixedFields,
  officeBlockFields,
  warekiFromYyyyMmDd,
} from './csv-employee.util';
import {
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  joinCsvRecord,
  splitBasicPensionNumber,
} from './csv-record.util';

const FORM_CODE = '2202700';
const FIELD_COUNT = 139;

function isSpouse(dependent: DependentInfo): boolean {
  return dependent.relationship === 'spouse';
}

function dependentBirthWareki(dependent: DependentInfo) {
  const date = dependent.birthDate ? toFormDate(dependent.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return birthWarekiFromDateString(toYyyyMmDdFromDate(date));
}

function toYyyyMmDdFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fillSpouseBlock(fields: string[], itemIndex: number, spouse: DependentInfo): void {
  const base = itemIndex - 1;
  fields[base + 2] = formatEmployeeKanaName(spouse.realName);
  fields[base + 3] = formatEmployeeKanjiName(spouse.realName);
  const birth = dependentBirthWareki(spouse);
  fields[base + 4] = birth.era;
  fields[base + 5] = birth.yymmdd;
}

function fillOtherDependentBlock(
  fields: string[],
  itemIndex: number,
  dependent: DependentInfo,
): void {
  const base = itemIndex - 1;
  fields[base + 1] = formatEmployeeKanaName(dependent.realName);
  fields[base + 2] = formatEmployeeKanjiName(dependent.realName);
  const birth = dependentBirthWareki(dependent);
  fields[base + 3] = birth.era;
  fields[base + 4] = birth.yymmdd;
  fields[base + 6] = '10';
}

export function buildDependentChangeDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationDependentChangePayload,
): string {
  const fields = fixedFields(FIELD_COUNT);
  const today = warekiFromYyyyMmDd(new Date().toISOString().slice(0, 10));
  const pension = splitBasicPensionNumber(employee.basicPensionNumber);
  const dependents = (payload.dependentsInfo ?? []) as DependentInfo[];
  const spouse = dependents.find(isSpouse);
  const others = dependents.filter((item) => !isSpouse(item));
  const office = officeBlockFields(tenant);

  fields[0] = FORM_CODE;
  fields[1] = office[0];
  fields[2] = office[1];
  fields[3] = office[2];
  fields[4] = '1';
  fields[5] = today.era;
  fields[6] = today.yymmdd;
  fields[7] = employeeRecordNumber(employee);
  fields[8] = formatEmployeeKanaName(employee.realName);
  fields[9] = formatEmployeeKanjiName(employee.realName);
  const employeeBirth = employeeBirthFields(employee);
  fields[10] = employeeBirth[0];
  fields[11] = employeeBirth[1];
  fields[12] = '';
  fields[13] = employee.myNumber;
  fields[14] = pension.office;
  fields[15] = pension.serial;
  fields[20] = payload.changeType ?? '1';

  if (spouse) {
    fillSpouseBlock(fields, 22, spouse);
  }
  if (others[0]) {
    fillOtherDependentBlock(fields, 70, others[0]);
  }
  if (others[1]) {
    fillOtherDependentBlock(fields, 103, others[1]);
  }

  return joinCsvRecord(fields);
}

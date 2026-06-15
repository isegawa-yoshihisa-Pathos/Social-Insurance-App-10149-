import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationStandardBonusPayload,
} from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import { toWarekiYymmdd } from './wareki';
import { resolveOfficeSymbolParts } from './office-block';
import {
  formatAmountField,
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  joinCsvRecord,
  splitBasicPensionNumber,
} from './csv-record.util';

const FORM_CODE = '2265700';

function birthWareki(employee: RegistrationFilingEmployeeSnapshot) {
  const date = employee.birthDate ? toFormDate(employee.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return toWarekiYymmdd(date) ?? { era: '', yymmdd: '' };
}

function paymentWareki(paymentDate: string) {
  const date = toFormDate(paymentDate);
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return toWarekiYymmdd(date) ?? { era: '', yymmdd: '' };
}

export function buildBonusPaymentDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationStandardBonusPayload,
): string {
  const office = resolveOfficeSymbolParts(tenant);
  const birth = birthWareki(employee);
  const payment = paymentWareki(payload.paymentDate);
  const pension = splitBasicPensionNumber(employee.basicPensionNumber);
  const total = payload.bonusAmount;

  const fields: (string | number)[] = [
    FORM_CODE,
    office.prefectureCode,
    office.districtCode,
    office.officeSymbol,
    employee.healthInsuranceRecordNumber || employee.pensionInsuranceRecordNumber,
    formatEmployeeKanaName(employee.realName),
    formatEmployeeKanjiName(employee.realName),
    birth.era,
    birth.yymmdd,
    payment.era,
    payment.yymmdd,
    formatAmountField(payload.currencyAmount),
    formatAmountField(payload.inKindAmount),
    formatAmountField(total),
    '',
    pension.office,
    pension.serial,
    '',
    '',
    '',
    '',
  ];

  return joinCsvRecord(fields);
}

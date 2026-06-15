import type {
  RegistrationFilingEmployeeSnapshot,
  RegistrationFilingTenantSnapshot,
  RegistrationStandardRemunerationPayload,
} from '../registration-filing-document';
import { toFormDate } from '../date-utils';
import { toWarekiYymmdd, toWarekiYearMonth } from './wareki';
import { resolveOfficeSymbolParts } from './office-block';
import {
  formatAmountField,
  formatEmployeeKanaName,
  formatEmployeeKanjiName,
  formatPayMonth,
  formatPaymentBaseDays,
  joinCsvRecord,
  splitBasicPensionNumber,
} from './csv-record.util';

const FORM_CODE = '2221700';

function priorRevisionWareki(payload: RegistrationStandardRemunerationPayload) {
  const yyyyMm = payload.previousEffectiveFrom?.slice(0, 7);
  if (!yyyyMm) {
    return { era: '', year: '', month: '' };
  }
  return toWarekiYearMonth(yyyyMm) ?? { era: '', year: '', month: '' };
}

function applicableWareki(payload: RegistrationStandardRemunerationPayload) {
  return toWarekiYearMonth(payload.effectiveFrom.slice(0, 7)) ?? { era: '', year: '', month: '' };
}

function birthWareki(employee: RegistrationFilingEmployeeSnapshot) {
  const date = employee.birthDate ? toFormDate(employee.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  return toWarekiYymmdd(date) ?? { era: '', yymmdd: '' };
}

function shortTimeFlag(employmentType: string): string {
  return employmentType === 'short-time-labor' || employmentType === 'short-time-worker'
    ? '1'
    : '';
}

function changeReason(payload: RegistrationStandardRemunerationPayload): string {
  if (payload.raiseDirection === 'increase') {
    return '固定的賃金の昇給に伴う随時改定';
  }
  if (payload.raiseDirection === 'decrease') {
    return '固定的賃金の降給に伴う随時改定';
  }
  return '固定的賃金の変動に伴う随時改定';
}

export function buildMonthlyChangeDataRecord(
  tenant: RegistrationFilingTenantSnapshot,
  employee: RegistrationFilingEmployeeSnapshot,
  payload: RegistrationStandardRemunerationPayload,
): string {
  const office = resolveOfficeSymbolParts(tenant);
  const birth = birthWareki(employee);
  const prior = priorRevisionWareki(payload);
  const applicable = applicableWareki(payload);
  const pension = splitBasicPensionNumber(employee.basicPensionNumber);
  const months = payload.months;
  const m1 = months[0];
  const m2 = months[1];
  const m3 = months[2];

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
    applicable.era,
    applicable.year,
    applicable.month,
    payload.previousHealthGrade != null ? String(payload.previousHealthGrade) : '',
    payload.previousPensionGrade != null ? String(payload.previousPensionGrade) : '',
    prior.era,
    prior.year,
    prior.month,
    payload.raiseMonthYyyyMm ? formatPayMonth(payload.raiseMonthYyyyMm) : '',
    payload.raiseDirection === 'increase' ? '1' : payload.raiseDirection === 'decrease' ? '2' : '1',
    payload.retroactivePayMonth ?? '',
    payload.retroactivePayAmount != null ? formatAmountField(payload.retroactivePayAmount) : '',
    m1 ? formatPayMonth(m1.yyyyMm) : '',
    m2 ? formatPayMonth(m2.yyyyMm) : '',
    m3 ? formatPayMonth(m3.yyyyMm) : '',
    m1 ? formatPaymentBaseDays(m1.paymentBaseDays) : '00',
    m2 ? formatPaymentBaseDays(m2.paymentBaseDays) : '00',
    m3 ? formatPaymentBaseDays(m3.paymentBaseDays) : '00',
    m1 ? formatAmountField(m1.currencyAmount) : '0',
    m2 ? formatAmountField(m2.currencyAmount) : '0',
    m3 ? formatAmountField(m3.currencyAmount) : '0',
    m1 ? formatAmountField(m1.inKindAmount) : '0',
    m2 ? formatAmountField(m2.inKindAmount) : '0',
    m3 ? formatAmountField(m3.inKindAmount) : '0',
    m1 ? formatAmountField(m1.totalAmount) : '0',
    m2 ? formatAmountField(m2.totalAmount) : '0',
    m3 ? formatAmountField(m3.totalAmount) : '0',
    formatAmountField(payload.totalRemuneration ?? 0),
    formatAmountField(payload.averageRemuneration ?? 0),
    '',
    '',
    pension.office,
    pension.serial,
    '',
    '',
    shortTimeFlag(employee.employmentType),
    changeReason(payload),
    '',
    '',
    '',
  ];

  return joinCsvRecord(fields);
}

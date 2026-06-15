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

const FORM_CODE = '2225700';

function priorRevisionWareki(payload: RegistrationStandardRemunerationPayload) {
  const yyyyMm = payload.previousEffectiveFrom?.slice(0, 7);
  if (!yyyyMm) {
    return { era: '', year: '', month: '' };
  }
  const wareki = toWarekiYearMonth(yyyyMm);
  if (!wareki) {
    return { era: '', year: '', month: '' };
  }
  return wareki;
}

function applicableWareki(payload: RegistrationStandardRemunerationPayload) {
  const wareki = toWarekiYearMonth(payload.effectiveFrom.slice(0, 7));
  return wareki ?? { era: '', year: '', month: '' };
}

function birthWareki(employee: RegistrationFilingEmployeeSnapshot) {
  const date = employee.birthDate ? toFormDate(employee.birthDate) : null;
  if (!date) {
    return { era: '', yymmdd: '' };
  }
  const wareki = toWarekiYymmdd(date);
  return wareki ?? { era: '', yymmdd: '' };
}

function shortTimeFlag(employmentType: string): string {
  return employmentType === 'short-time-labor' || employmentType === 'short-time-worker'
    ? '1'
    : '';
}

function annualAverageFlag(source: string): string {
  return source.includes('annual_average') ? '1' : '';
}

export function buildTeijiSanteiDataRecord(
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
  const m4 = months[0];
  const m5 = months[1];
  const m6 = months[2];

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
    '',
    '',
    '',
    '',
    '',
    pension.office,
    pension.serial,
    applicable.era,
    applicable.year,
    applicable.month,
    payload.previousHealthGrade != null ? String(payload.previousHealthGrade) : '',
    payload.previousPensionGrade != null ? String(payload.previousPensionGrade) : '',
    prior.era,
    prior.year,
    prior.month,
    payload.raiseMonthYyyyMm ? formatPayMonth(payload.raiseMonthYyyyMm) : '',
    payload.raiseDirection === 'increase' ? '1' : payload.raiseDirection === 'decrease' ? '2' : '',
    payload.retroactivePayMonth ?? '',
    payload.retroactivePayAmount != null ? formatAmountField(payload.retroactivePayAmount) : '',
    '04',
    '05',
    '06',
    m4 ? formatPaymentBaseDays(m4.paymentBaseDays) : '00',
    m5 ? formatPaymentBaseDays(m5.paymentBaseDays) : '00',
    m6 ? formatPaymentBaseDays(m6.paymentBaseDays) : '00',
    m4 ? formatAmountField(m4.currencyAmount) : '0',
    m5 ? formatAmountField(m5.currencyAmount) : '0',
    m6 ? formatAmountField(m6.currencyAmount) : '0',
    m4 ? formatAmountField(m4.inKindAmount) : '0',
    m5 ? formatAmountField(m5.inKindAmount) : '0',
    m6 ? formatAmountField(m6.inKindAmount) : '0',
    m4 ? formatAmountField(m4.totalAmount) : '0',
    m5 ? formatAmountField(m5.totalAmount) : '0',
    m6 ? formatAmountField(m6.totalAmount) : '0',
    formatAmountField(payload.totalRemuneration ?? 0),
    formatAmountField(payload.averageRemuneration ?? 0),
    '',
    '',
    pension.office,
    pension.serial,
    '',
    '',
    '',
    '',
    shortTimeFlag(employee.employmentType),
    '',
    annualAverageFlag(payload.source),
    '',
    '',
  ];

  return joinCsvRecord(fields);
}

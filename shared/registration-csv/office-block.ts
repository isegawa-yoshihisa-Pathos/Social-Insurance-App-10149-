import { CURRENT_ASSOCIATION_RATE_TABLE } from '../social-insurance/insurance-rates/association';
import type { RegistrationFilingTenantSnapshot } from '../registration-filing-document';

export interface OfficeSymbolParts {
  prefectureCode: string;
  districtCode: string;
  officeSymbol: string;
}

export function resolvePrefectureCodeFromAddress(address1: string): string {
  const s = address1.trim();
  if (!s) {
    return '';
  }
  const rows = [...CURRENT_ASSOCIATION_RATE_TABLE.prefectures].sort(
    (a, b) => b.prefectureName.length - a.prefectureName.length,
  );
  const hit = rows.find((row) => s.startsWith(row.prefectureName));
  return hit?.prefectureCode ?? '';
}

export function parseOfficeRecordNumber(recordNumber: string): {
  districtCode: string;
  officeSymbol: string;
} {
  const trimmed = recordNumber.trim();
  if (!trimmed) {
    return { districtCode: '', officeSymbol: '' };
  }

  const hyphen = trimmed.indexOf('-');
  if (hyphen >= 0) {
    return {
      districtCode: trimmed.slice(0, hyphen).replace(/\D/g, '').padStart(2, '0').slice(-2),
      officeSymbol: trimmed.slice(hyphen + 1).trim(),
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 2) {
    return {
      districtCode: digits.slice(0, 2),
      officeSymbol: trimmed.slice(2).trim() || digits.slice(2),
    };
  }

  return { districtCode: '', officeSymbol: trimmed };
}

export function resolveOfficeSymbolParts(
  tenant: RegistrationFilingTenantSnapshot,
): OfficeSymbolParts {
  const settings = tenant.socialInsuranceSettings ?? {};
  const recordNumber = String(
    settings['pensionInsuranceTenantRecordNumber'] ??
      settings['healthInsuranceTenantRecordNumber'] ??
      '',
  );
  const parsed = parseOfficeRecordNumber(recordNumber);
  return {
    prefectureCode: resolvePrefectureCodeFromAddress(tenant.address.address1 ?? ''),
    districtCode: parsed.districtCode,
    officeSymbol: parsed.officeSymbol,
  };
}

export function splitZipcode(zipcode: string): { parent: string; child: string } {
  const digits = zipcode.replace(/\D/g, '');
  if (digits.length < 7) {
    return { parent: '', child: '' };
  }
  return { parent: digits.slice(0, 3), child: digits.slice(3, 7) };
}

export function formatOwnerFullName(tenant: RegistrationFilingTenantSnapshot): string {
  const owner = tenant.ownerName;
  const last = owner.ownerLastName?.trim() ?? '';
  const first = owner.ownerFirstName?.trim() ?? '';
  if (!last && !first) {
    return '';
  }
  return `${last}　${first}`.trim();
}

export function formatOfficeAddress(tenant: RegistrationFilingTenantSnapshot): string {
  const { address1, address2, address3 } = tenant.address;
  return [address1, address2, address3].filter(Boolean).join('');
}

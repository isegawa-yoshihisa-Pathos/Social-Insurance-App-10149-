export function toFormDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function getAgeAttainmentYyyyMm(birthDate: Date, age: number): string {
  const birthdayOfAge = new Date(
    birthDate.getFullYear() + age,
    birthDate.getMonth(),
    birthDate.getDate()
  );
  
  const attainmentDate = new Date(birthdayOfAge);
  attainmentDate.setDate(birthdayOfAge.getDate() - 1);

  const yyyy = attainmentDate.getFullYear();
  const mm = String(attainmentDate.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function checkLicense(params: {
  licenseStartAt: Date | null | undefined;
  yyyyMm: string;
}): boolean {
  const { licenseStartAt, yyyyMm } = params;
  if (!licenseStartAt) return false;
  const licenseStartAtYyyyMm = `${licenseStartAt.getFullYear()}-${String(licenseStartAt.getMonth() + 1).padStart(2, '0')}`;
  if (licenseStartAtYyyyMm > yyyyMm) return false;
  return true;
}


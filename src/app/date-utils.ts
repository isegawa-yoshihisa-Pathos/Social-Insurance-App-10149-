import { Timestamp } from '@angular/fire/firestore';

export function toFormDate(value: unknown): Date | null {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as Timestamp).toDate === 'function'
  ) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function getAge(birthDate: Date | null | undefined): number {
  if (!birthDate) {
    return 0;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const currentMonth = today.getMonth();
  const birthMonth = birthDate.getMonth();
  if (currentMonth < birthMonth) {
    age -= 1;
  } else if (currentMonth === birthMonth) {
    const currentDay = today.getDate();
    const birthDay = birthDate.getDate();
    if (currentDay < birthDay) {
      age -= 1;
    }
  }
  return age;
}

export function toFirestoreTimestamp(date: Date | null | undefined): Timestamp | null {
  if (!date) {
    return null;
  }
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Timestamp.fromDate(normalized);
}

export function formatJapaneseDate(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

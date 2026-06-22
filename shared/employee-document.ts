import type { FirestoreTimestamp } from './firestore-types';
import { EmployeePersonalInfo } from './personal-document';
import type { MultiWorkplaceSettings } from './social-insurance/multi-workplace/multi-workplace-settings';

export interface EmployeeDocument {
  uid: string;
  employeePersonalInfo: EmployeePersonalInfo;
  employeeEmployInfo: EmployeeEmployInfo;
  leaveInfo?: EmployeeLeaveRecord[];
  role: 'admin' | 'member';
  multiWorkplaceSettings?: MultiWorkplaceSettings;
  updatedAt?: FirestoreTimestamp;
}

export type { MultiWorkplaceSettings, WorkplaceSelectionType } from './social-insurance/multi-workplace/multi-workplace-settings';
export {
  canManageDependents,
  createDefaultMultiWorkplaceSettings,
  hasMultipleWorkplacesEnabled,
  hasMultipleWorkplacesEnabledForEmployee,
  isNonSelectedWorkplace,
  normalizeMultiWorkplaceSettings,
  WORKPLACE_SELECTION_LABELS,
} from './social-insurance/multi-workplace/multi-workplace-settings';

export interface EmployeeEmployInfo {
  employeeId: string;
  position: string;
  department: string;
  payType: 'monthly' | 'daily-monthly' | 'weekly' | 'daily' | 'hourly';
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: FirestoreTimestamp | null;
  resignAt: FirestoreTimestamp | null;
  licenseStartAt: FirestoreTimestamp | null;
  licenseEndAt: FirestoreTimestamp | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

export type EmployeeLeaveType = 'maternity' | 'childcare';

export interface EmployeeLeaveRecord {
  type: EmployeeLeaveType;
  startAt: FirestoreTimestamp | null;
  endAt: FirestoreTimestamp | null;
  reason?: string;
  applicationId?: string;
  createdAt?: FirestoreTimestamp;
}

export interface EmployeeLeaveFormData {
  type: EmployeeLeaveType;
  startAt: Date | null;
  endAt: Date | null;
  reason: string;
}

export interface EmployeeEmployFormData {
  employeeId: string;
  position: string;
  department: string;
  payType: 'monthly' | 'daily-monthly' | 'weekly' | 'daily' | 'hourly';
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: Date | null;
  resignAt: Date | null;
  licenseStartAt: Date | null;
  licenseEndAt: Date | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

export type PayType = EmployeeEmployInfo['payType'];
export type EmploymentType = EmployeeEmployInfo['employmentType'];

export const DEFAULT_PAY_TYPE: PayType = 'monthly';
export const DEFAULT_EMPLOYMENT_TYPE: EmploymentType = 'full-time';

const VALID_PAY_TYPES: readonly PayType[] = [
  'monthly',
  'daily-monthly',
  'weekly',
  'daily',
  'hourly',
];

const VALID_EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  'full-time',
  'short-time-worker',
  'short-time-labor',
];

/** 未設定（空文字・null・undefined・不正値）時は完全月給 */
export function resolvePayType(value: string | null | undefined): PayType {
  if (value && VALID_PAY_TYPES.includes(value as PayType)) {
    return value as PayType;
  }
  return DEFAULT_PAY_TYPE;
}

/** 未設定（空文字・null・undefined・不正値）時は正社員 */
export function resolveEmploymentType(value: string | null | undefined): EmploymentType {
  if (value && VALID_EMPLOYMENT_TYPES.includes(value as EmploymentType)) {
    return value as EmploymentType;
  }
  return DEFAULT_EMPLOYMENT_TYPE;
}

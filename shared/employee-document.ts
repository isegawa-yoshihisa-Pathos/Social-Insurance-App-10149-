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

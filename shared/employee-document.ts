import type { FirestoreTimestamp } from './firestore-types';
import { EmployeePersonalInfo } from './personal-document';

export interface EmployeeDocument {
  uid: string;
  employeePersonalInfo: EmployeePersonalInfo;
  employeeEmployInfo: EmployeeEmployInfo;
  leaveInfo?: EmployeeLeaveRecord[];
  role: 'admin' | 'member';
  updatedAt?: FirestoreTimestamp;
}

export interface EmployeeEmployInfo {
  employeeId: string;
  position: string;
  department: string;
  payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
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
  payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: Date | null;
  resignAt: Date | null;
  licenseStartAt: Date | null;
  licenseEndAt: Date | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

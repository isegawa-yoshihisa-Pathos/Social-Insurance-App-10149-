import { Timestamp } from '@angular/fire/firestore';
import { EmployeePersonalInfo } from './personal-document';

export interface EmployeeDocument {
  uid: string;
  employeePersonalInfo: EmployeePersonalInfo;
  employeeEmployInfo: EmployeeEmployInfo;
  leaveInfo?: EmployeeLeaveRecord[];
  role: 'admin' | 'member';
  updatedAt?: Timestamp;
}

export interface EmployeeEmployInfo {
  employeeId: string;
  position: string;
  department: string;
  payType: 'monthly' | 'daily-monthly' | 'weekly' | 'daily' | 'hourly';
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: Timestamp | null;
  resignAt: Timestamp | null;
  licenseStartAt: Timestamp | null;
  licenseEndAt: Timestamp | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

export type EmployeeLeaveType = 'maternity' | 'childcare';

export interface EmployeeLeaveRecord {
  type: EmployeeLeaveType;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  reason?: string;
  applicationId?: string;
  createdAt?: Timestamp;
}

export interface EmployeeLeaveFormData {
  type: EmployeeLeaveType;
  startAt: Date | null;
  endAt: Date | null;
  reason: string;
}

export interface EmployeeResignFormData {
  resignAt: Date | null;
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

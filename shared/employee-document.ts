import type { FirestoreTimestamp } from './firestore-types';
import { EmployeePersonalInfo } from './personal-document';

export interface EmployeeDocument {
  uid: string;
  employeePersonalInfo: EmployeePersonalInfo;
  employeeEmployInfo: EmployeeEmployInfo;

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
  leaveAt: FirestoreTimestamp | null;
  returnAt: FirestoreTimestamp | null;
  resignAt: FirestoreTimestamp | null;
  licenseStartAt: FirestoreTimestamp | null;
  licenseEndAt: FirestoreTimestamp | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

export interface EmployeeEmployFormData {
  employeeId: string;
  position: string;
  department: string;
  payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
  employmentType: 'full-time' | 'short-time-worker' | 'short-time-labor';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: Date | null;
  leaveAt: Date | null;
  returnAt: Date | null;
  resignAt: Date | null;
  licenseStartAt: Date | null;
  licenseEndAt: Date | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}
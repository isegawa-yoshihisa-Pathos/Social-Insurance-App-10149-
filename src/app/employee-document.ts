import { Timestamp } from '@angular/fire/firestore';
import { EmployeePersonalInfo } from './personal-document';

export interface EmployeeDocument {
  uid: string;
  employeePersonalInfo: EmployeePersonalInfo;
  employeeEmployInfo?: EmployeeEmployInfo;

  role: 'admin' | 'member';
  updatedAt?: Timestamp;
}

export interface EmployeeEmployInfo {
  position: string;
  department: string;
  payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
  employmentType: 'full-time' | 'part-time' | 'temporary' | '';
  status: 'active' | 'leave' | 'resigned';
  joinedAt: Timestamp | null;
  leaveAt: Timestamp | null;
  returnAt: Timestamp | null;
  resignAt: Timestamp | null;
  licenseStartAt: Timestamp | null;
  licenseEndAt: Timestamp | null;
  healthInsuranceRecordNumber: string;
  pensionInsuranceRecordNumber: string;
}

export interface EmployeeEmployFormData {
  position: string;
  department: string;
  payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
  employmentType: 'full-time' | 'part-time' | 'temporary' | '';
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
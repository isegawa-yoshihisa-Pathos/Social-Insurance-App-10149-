import { Timestamp } from '@angular/fire/firestore';
import { EmployeePersonalInfo } from './personal-document';

export interface EmployeeDocument {
    uid: string;
    employeePersonalInfo: EmployeePersonalInfo;

    role: 'admin' | 'member';
    status: 'active' | 'leave' | 'resigned';
    updatedAt?: Timestamp;
}

export interface EmployeeEmploymentFormData {
    position: string;
    department: string;
    payType: 'monthly' | 'weekly' | 'daily' | 'hourly' | '';
    employmentType: 'full-time' | 'part-time' | 'temporary' | '';
    joinedAt: string;       // 'YYYY-MM-DD'
    leaveAt: string;
    returnAt: string;
    resignAt: string;
    licenseStartAt: string;
    licenseEndAt: string;
    healthInsuranceRecordNumber: string;
    pensionInsuranceRecordNumber: string;
  }
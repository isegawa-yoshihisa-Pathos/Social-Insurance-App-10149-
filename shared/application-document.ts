import type { FirestoreTimestamp } from './firestore-types';
import type { EmployeeLeaveType } from './employee-document';

export interface ApplicationDocument {
  eid: string;
  employeeId: string;
  displayName: string;
  type: 'allowance' | 'leave' | 'resign';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  allowanceDetails?: {
    allowanceType: string;
    amount: number;
    reason: string;
  };
  leaveDetails?: {
    type: EmployeeLeaveType;
    startAt: FirestoreTimestamp | null;
    endAt: FirestoreTimestamp | null;
    reason: string;
  };
  resignDetails?: {
    resignAt: FirestoreTimestamp | null;
    reason: string;
  };
}

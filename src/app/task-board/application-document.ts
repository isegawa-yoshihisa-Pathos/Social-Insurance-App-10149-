export interface ApplicationDocument {
    eid: string;
    employeeId: string;
    displayName: string;
    type: 'allowance' | 'leave' | 'resign';
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    updatedAt: any;
    allowanceDetails?: {
        allowanceType: string;
        amount: number;
        reason: string;
    };
    
    leaveDetails?: {
        leaveAt: string;
        returnAt: string;
        reason: string;
    };
    
    resignDetails?: {
        resignAt: string;
        reason: string;
    }
}
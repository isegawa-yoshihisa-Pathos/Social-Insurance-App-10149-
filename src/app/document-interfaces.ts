import { Timestamp } from '@angular/fire/firestore';

export interface AccountDocument {
    email: string,
    currentTenantId: string,
    affiliations?: Record<string, string>,
    lastView: Timestamp,
    createdAt: Timestamp,
}

export interface AffiliationDocument {
    uid: string,
    tid: string,
    eid?: string,
    displayName: string,
    tenantName: string,
    role: 'admin' | 'member',
    status: 'active' | 'leave' | 'resigned',
    joinedAt: Timestamp,
}
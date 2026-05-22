import { Timestamp } from '@angular/fire/firestore';

export interface AccountDocument {
    email: string,
    currentTenantId: string,
    lastView: Timestamp,
    createdAt: Timestamp,
}

export interface AffiliationDocument {
    uid: string,
    eid: string,
    displayName: string,
    tenantName: string,
    role: 'admin' | 'member',
    status: 'active' | 'invited' | 'suspended' | 'archived',
    joinedAt: Timestamp,
}
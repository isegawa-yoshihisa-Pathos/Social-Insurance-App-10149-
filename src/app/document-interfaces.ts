import { Timestamp } from '@angular/fire/firestore';

export interface AccountDocument {
    email: string,
    currentEstablishmentId: string,
    lastView: Timestamp,
    createdAt: Timestamp,
}

export interface AffiliationDocument {
    uid: string,
    eid: string,
    displayName: string,
    establishmentName: string,
    role: 'admin' | 'member',
    status: 'active' | 'invited' | 'suspended' | 'archived',
    joinedAt: Timestamp,
}
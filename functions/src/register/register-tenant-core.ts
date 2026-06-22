import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

export interface TenantRegistrationInput {
    tenantName: string;
    tenantNameKana: string;
    zipcode: string;
    address: unknown;
    ownerName: unknown;
    phoneNumber: unknown;
  }
  
export function validateTenantInput(data: TenantRegistrationInput): void {
    if (!data.tenantName || !data.tenantNameKana || !data.zipcode
        || !data.address || !data.ownerName || !data.phoneNumber) {
        throw new HttpsError('invalid-argument', '入力内容を確認してください。');
    }
}

export function getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
        return String((error as { code: string }).code);
    }
    return undefined;
}
  
export function buildTenantRegistrationBatch(
    db: FirebaseFirestore.Firestore,
    uid: string,
    input: TenantRegistrationInput,
    ) {
    const batch = db.batch();
    const tenantRef = db.collection('tenants').doc();
    const tid = tenantRef.id;
    const employeeRef = tenantRef.collection('employees').doc();
    const eid = employeeRef.id;
    const now = admin.firestore.FieldValue.serverTimestamp();

    batch.set(tenantRef, { ...input, createdAt: now, updatedAt: now });
    batch.set(employeeRef, {
        uid,
        role: 'admin',
        employeePersonalInfo: {
            displayName: '',
            realName: {
                lastName: '',
                firstName: '',
                lastNameKana: '',
                firstNameKana: '',
            },
            myNumber: '',
            basicPensionNumber: '',
            birthDate: null,
            phoneNumber: { tel1: '', tel2: '', tel3: '' },
            zipcode: '',
            address: { address1: '', address2: '', address3: '' },
            hasDependents: false,
            dependentsInfo: [],
        },
        employeeEmployInfo: {
            employeeId: '',
            position: '',
            department: '',
            payType: 'monthly',
            employmentType: 'full-time',
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            resignAt: null,
            licenseStartAt: null,
            licenseEndAt: null,
            healthInsuranceRecordNumber: '',
            pensionInsuranceRecordNumber: '',
        },
        leaveInfo: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const affiliationRef = db.collection('affiliations').doc(`${uid}_${tid}`);
    batch.set(affiliationRef, {
        uid,
        tid,
        eid,
        displayName: '',
        tenantName: input.tenantName,
        role: 'admin',
        status: 'active',
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { batch, tid, eid };
}
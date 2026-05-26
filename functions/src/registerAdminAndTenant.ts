import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

export function getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
        return String((error as { code: string }).code);
    }
    return undefined;
}

export const registerAdminAndTenant = onCall({
    region: 'asia-northeast1',
    cors: true,
}, async (request) => {
    const { email, password, tenantName, tenantNameKana, zipcode, address, ownerName, phoneNumber } = request.data;

    if (!email || !password || !tenantName || !tenantNameKana || !zipcode || !address || !ownerName || !phoneNumber) {
        throw new HttpsError('invalid-argument', '入力内容を確認してください。');
    }

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
        });

        const uid = userRecord.uid;

        const db = admin.firestore();

        const accountRef = db.collection('accounts').doc(uid);
        const tenantRef = db.collection('tenants').doc();
        const tid = tenantRef.id;
        const employeeRef = db.collection('tenants').doc(tid).collection('employees').doc();
        const eid = employeeRef.id;

        const batch = db.batch();

        batch.set(accountRef, {
            email,
            currentTenantId: tid,
            affiliations: {
                [tid]: eid,
            },
            lastView: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        batch.set(tenantRef, {
            tenantName,
            tenantNameKana,
            zipcode,
            address,
            ownerName,
            phoneNumber,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        batch.set(employeeRef, {
            uid,
            role: 'admin',
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const affiliationRef = db.collection('affiliations').doc(`${uid}_${tid}`);
        batch.set(affiliationRef, {
            uid,
            tid,
            tenantName,
            role: 'admin',
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return { success: true, uid, email, password, tid };
    } catch (error) {
        switch (getErrorCode(error)) {
            case 'auth/email-already-exists':
            case 'auth/email-already-in-use':
                throw new HttpsError('already-exists', 'このメールアドレスは既に登録されています');
            case 'auth/weak-password':
                throw new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください');
            case 'auth/invalid-email':
                throw new HttpsError('invalid-argument', 'メールアドレスの形式が正しくありません');
            case 'auth/invalid-password':
                throw new HttpsError('invalid-argument', 'パスワードが正しくありません');
            default:
                throw new HttpsError('internal', '事業所登録に失敗しました。しばらくしてから再度お試しください');
            }
        }
});
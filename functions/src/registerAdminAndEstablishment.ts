import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export function getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'code' in error) {
        return String((error as { code: string }).code);
    }
    return undefined;
}

export const registerAdminAndEstablishment = onCall({
    region: 'asia-northeast1',
    cors: true,
}, async (request) => {
    const { name, email, password, establishmentName, zipcode, address, ownerName, phoneNumber, corporateNumber } = request.data;

    if (!name || !email || !password || !establishmentName || !zipcode || !address || !ownerName || !phoneNumber || !corporateNumber) {
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
        const establishmentRef = db.collection('establishments').doc();
        const eid = establishmentRef.id;

        const batch = db.batch();

        batch.set(accountRef, {
            email,
            currentEstablishmentId: eid,
            lastView: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        batch.set(establishmentRef, {
            establishmentName,
            zipcode,
            address,
            ownerName,
            phoneNumber,
            corporateNumber,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const affiliationRef = db.collection('affiliations').doc(`${uid}_${eid}`);
        batch.set(affiliationRef, {
            uid,
            eid,
            displayName:name,
            establishmentName,
            role: 'admin',
            status: 'active',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return { success: true, uid, email, password, eid };
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
import { onCall } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { validateTenantInput, buildTenantRegistrationBatch, getErrorCode } from './register-tenant-core';

export const registerAdminAndTenant = onCall(
    { region: 'asia-northeast1', cors: true },
    async (request) => {
    try{
        const { email, password, ...tenantInput } = request.data;
        if (!email || !password) {
            throw new HttpsError('invalid-argument', '入力内容を確認してください。');
        }
    
        validateTenantInput(tenantInput);
    
        const userRecord = await admin.auth().createUser({ email, password });
        const uid = userRecord.uid;

        const db = admin.firestore();
        const { batch, tid, eid } = buildTenantRegistrationBatch(db, uid, tenantInput);
        const now = admin.firestore.FieldValue.serverTimestamp();
    
        const accountRef = db.collection('accounts').doc(uid);
        batch.set(accountRef, {
        email,
        currentTenantId: tid,
        affiliations: { [tid]: eid },
        lastView: now,
        createdAt: now,
        updatedAt: now,
        });
    
        await batch.commit();
        return { success: true, uid, email, password, tid };
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
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
    }
  );
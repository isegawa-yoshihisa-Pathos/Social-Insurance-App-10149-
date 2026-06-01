import { onCall } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { validateTenantInput, buildTenantRegistrationBatch, getErrorCode } from './register-tenant-core';

export const registerTenantForExistingUser = onCall(
    { region: 'asia-northeast1', cors: true },
    async (request) => {
    try{
        const uid = request.auth?.uid;
        if (!uid) {
            throw new HttpsError('unauthenticated', 'ログインが必要です。');
        }
    
        const {
            tenantName,
            tenantNameKana,
            zipcode,
            address,
            ownerName,
            phoneNumber,
        } = request.data ?? {};
        const tenantInput = { tenantName, tenantNameKana, zipcode, address, ownerName, phoneNumber };
        validateTenantInput(tenantInput);
    
        const db = admin.firestore();
        const accountRef = db.collection('accounts').doc(uid);
        const accountSnap = await accountRef.get();
        if (!accountSnap.exists) {
            throw new HttpsError('not-found', 'アカウントが見つかりません。');
        }
    
        const { batch, tid, eid } = buildTenantRegistrationBatch(db, uid, tenantInput);
        const now = admin.firestore.FieldValue.serverTimestamp();

        batch.set(accountRef, {
            currentTenantId: tid,
            affiliations: { [tid]: eid },
            lastView: now,
            updatedAt: now,
        }, { merge: true });
    
        await batch.commit();
        return { success: true, tid, eid };
    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        switch (getErrorCode(error)) {
            case 'not-found':
                throw new HttpsError('not-found', 'アカウントが見つかりません。');
            case 'invalid-argument':
                throw new HttpsError('invalid-argument', '入力内容を確認してください。');
            case 'internal':
                throw new HttpsError('internal', '事業所登録に失敗しました。しばらくしてから再度お試しください');
            case 'unauthenticated':
                throw new HttpsError('unauthenticated', 'ログインが必要です。');
            case 'already-exists':
                throw new HttpsError('already-exists', 'このメールアドレスは既に登録されています');
            default:
                throw new HttpsError('internal', '事業所登録に失敗しました。しばらくしてから再度お試しください');
            }
        }
    },
);
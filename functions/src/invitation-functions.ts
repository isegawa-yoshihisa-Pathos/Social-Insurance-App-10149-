import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const saveInvitationTemplate = onCall({
    region: 'asia-northeast1',
    cors: true,
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, templateText, replyToEmail } = request.data;

    if (!tid || typeof tid !== 'string') {
        throw new HttpsError('invalid-argument', '入力内容を確認してください。');
    }
    
    if ( !templateText) {
        throw new HttpsError('invalid-argument', '入力内容を確認してください。');
    }

    if (replyToEmail && !isValidEmail(replyToEmail)) {
        throw new HttpsError('invalid-argument', '返信先メールアドレスの形式が正しくありません。');
    }

    const db = admin.firestore();

    const affiliationSnap = await db
        .collection('affiliations')
        .doc(`${uid}_${tid}`)
        .get();

    if (!affiliationSnap.exists) {
        throw new HttpsError('permission-denied', 'この事業所への所属がありません。');
    }

    const affiliation = affiliationSnap.data();

    if (affiliation?.role !== 'admin' || affiliation?.status !== 'active') {
        throw new HttpsError('permission-denied', '管理者権限が必要です。');
    }

    await db
        .collection('tenants')
        .doc(tid)
        .collection('settings')
        .doc('invitationSetting')
        .set({
            templateText,
            replyToEmail: String(replyToEmail ?? '').trim(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
    }, { merge: true });

    return { success: true };
});

function isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

export const saveInvitationImportSettings = onCall({
    region: 'asia-northeast1',
    cors: true,
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { tid, nameHeaders, emailHeaders } = request.data;

    if (!tid || !Array.isArray(nameHeaders) || !Array.isArray(emailHeaders)) {
        throw new HttpsError('invalid-argument', '入力内容を確認してください。');
    }

    const db = admin.firestore();

    const affiliationSnap = await db
        .collection('affiliations')
        .doc(`${uid}_${tid}`)
        .get();

    if (!affiliationSnap.exists) {
        throw new HttpsError('permission-denied', 'この事業所への所属がありません。');
    }

    const affiliation = affiliationSnap.data();

    if (affiliation?.role !== 'admin' || affiliation?.status !== 'active') {
        throw new HttpsError('permission-denied', '管理者権限が必要です。');
    }

    await db
        .collection('tenants')
        .doc(tid)
        .collection('settings')
        .doc('invitationSetting')
        .set({
            nameHeaders: normalizeHeaders(nameHeaders),
            emailHeaders: normalizeHeaders(emailHeaders),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
        }, { merge: true });

    return { success: true };
});

function normalizeHeaders(headers: unknown[]): string[] {
    return Array.from(
        new Set(
            headers
                .filter((header): header is string => typeof header === 'string')
                .map((header) => header.trim())
                .filter(Boolean),
        ),
    );
}
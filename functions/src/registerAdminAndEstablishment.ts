import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const registerAdminAndEstablishment = onCall({
    region: 'asia-northeast1',
    cors: true,
}, async (request) => {
    const { name, email, password, establishmentName, zipcode, address, ownerName, phoneNumber, corporateNumber } = request.data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        const uid = userRecord.uid;

        const db = admin.firestore();

        const userRef = await db.collection('users').doc(uid);
        const establishmentRef = db.collection('establishments').doc();
        const eid = establishmentRef.id;

        const batch = db.batch();

        batch.set(userRef, {
            name,
            email,
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
        });

        const affiliationRef = db.collection('affiliations').doc(`${uid}_${eid}`);
        batch.set(affiliationRef, {
            uid,
            eid,
            role: 'admin',
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();

        await admin.auth().setCustomUserClaims(uid, {
            role: 'admin',
        });

        return { success: true, email, password };
    } catch (error) {
        console.error(error);
        throw new HttpsError('internal', 'エラーが発生しました');
    }
});
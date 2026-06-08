import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export async function assertTenantAdmin(
    db: admin.firestore.Firestore,
    uid: string,
    tid: string,
): Promise<void> {
    const snap = await db.collection('affiliations').doc(`${uid}_${tid}`).get();
    if (!snap.exists) {
        throw new Error('PERMISSION_DENIED:この事業所への所属がありません。');
    }
    const affiliation = snap.data();
    if (affiliation?.role !== 'admin') {
        throw new Error('PERMISSION_DENIED:管理者権限が必要です。');
    }
}

export function mapCoreErrorToHttpsError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    const [code, ...rest] = message.split(':');
    const text = rest.join(':') || message;
  
    switch (code) {
      case 'PERMISSION_DENIED':
        throw new HttpsError('permission-denied', text);
      case 'NOT_FOUND':
        throw new HttpsError('not-found', text);
      case 'INVALID_ARGUMENT':
        throw new HttpsError('invalid-argument', text);
      case 'FAILED_PRECONDITION':
        throw new HttpsError('failed-precondition', text);
      default:
        throw new HttpsError('internal', text);
    }
  }
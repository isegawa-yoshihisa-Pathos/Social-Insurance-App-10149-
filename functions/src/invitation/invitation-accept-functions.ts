import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

interface ValidateInvitationInput {
  token: string;
  email: string;
}

interface AcceptInvitationInput {
  token: string;
  email: string;
  loginEmail: string;
  password?: string;
  mode: 'create' | 'link';
}

export const validateInvitationToken = onCall<ValidateInvitationInput>(
  {
    region: 'asia-northeast1',
    invoker: 'public',
    cors: true,
  },
  async (request) => {
    const token = String(request.data?.token ?? '').trim();

    if (!token) {
      throw new HttpsError('invalid-argument', 'リンクを確認してください。');
    }

    const email = normalizeEmail(request.data?.email);

    if (!email) {
      throw new HttpsError('invalid-argument', 'メールアドレスを入力してください。');
    }

    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      throw new HttpsError('not-found', '招待が見つかりません。');
    }

    assertInvitationCanBeAccepted(invitation.data);
    assertInvitationEmailMatches(invitation.data, email);

    const tenantSnap = await admin.firestore().collection('tenants').doc(invitation.tid).get();
    const tenant = tenantSnap.data();

    return {
      tid: invitation.tid,
      tenantName: tenant?.tenantName ?? '',
      name: invitation.data.name ?? '',
      email: invitation.data.contactEmail ?? '',
      defaultLoginEmail: email,
      role: invitation.data.role ?? 'member',
      expiresAt: invitation.data.expiresAt?.toMillis?.() ?? null,
    };
  },
);

export const acceptInvitation = onCall<AcceptInvitationInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    invoker: 'public',
  },
  async (request) => {
    const token = String(request.data?.token ?? '').trim();
    const email = normalizeEmail(request.data?.email);
    const loginEmail = normalizeEmail(request.data?.loginEmail);
    const password = String(request.data?.password ?? '');
    const mode = request.data?.mode ?? 'create';

    if (!loginEmail) {
      throw new HttpsError('invalid-argument', 'メールアドレスを入力してください。');
    }

    if (!email) {
      throw new HttpsError('invalid-argument', '招待されたメールアドレスが見つかりません。');
    }

    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      throw new HttpsError('not-found', '招待が見つかりません。');
    }

    assertInvitationCanBeAccepted(invitation.data);
    assertInvitationEmailMatches(invitation.data, email);

    const db = admin.firestore();
    const tenantSnap = await db.collection('tenants').doc(invitation.tid).get();

    if (!tenantSnap.exists) {
      throw new HttpsError('not-found', '事業所が見つかりません。');
    }

    const tenantName = String(tenantSnap.data()?.tenantName ?? '');
    const displayName = String(invitation.data.name ?? '').trim();
    const role = invitation.data.role;

    if (!displayName) {
      throw new HttpsError('failed-precondition', '招待情報が不完全です。');
    }

    let uid = '';
    let userRecord: admin.auth.UserRecord | null = null;

    if (mode === 'link') {
      uid = request.auth?.uid ?? '';
      if (!uid) {
        throw new HttpsError('unauthenticated', 'ログインが必要です。');
      }
      userRecord = await admin.auth().getUser(uid);
      if (normalizeEmail(userRecord.email) !== loginEmail) {
        throw new HttpsError('permission-denied', 'ログイン中のアカウントと一致しません。');
      }
    } else {
      if (!password || password.length < 6) {
        throw new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください。');
      }
      try {
        userRecord = await admin.auth().createUser({
          email: loginEmail,
          password,
        });
        uid = userRecord.uid;
      } catch (error: any) {
        throw mapAuthCreateError(error);
      }
    }

    try {
      const accountRef = db.collection('accounts').doc(uid);
      const affiliationRef = db.collection('affiliations').doc(`${uid}_${invitation.tid}`);

      const [accountSnap, affiliationSnap] = await Promise.all([
        accountRef.get(),
        affiliationRef.get(),
      ]);

      if (affiliationSnap.exists) {
        const affiliation = affiliationSnap.data();

        if (affiliation?.status === 'active') {
          throw new HttpsError('already-exists', 'この事業所には既に所属しています。');
        }
      }

      const existingEmployeeId = accountSnap.data()?.affiliations?.[invitation.tid];

      if (existingEmployeeId) {
        throw new HttpsError('already-exists', 'この事業所には既に所属しています。');
      }

      const employeeRef = db
        .collection('tenants')
        .doc(invitation.tid)
        .collection('employees')
        .doc();

      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();
      
      const eid = employeeRef.id;

      batch.set(
        accountRef,
        {
          email: loginEmail,
          currentTenantId: invitation.tid,
          affiliations: {
            [invitation.tid]: employeeRef.id,
          },
          lastView: now,
          updatedAt: now,
          ...(accountSnap.exists ? {} : { createdAt: now }),
        },
        { merge: true },
      );

      batch.set(employeeRef, {
        uid,
        role,
        employeePersonalInfo: {
          displayName,
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
          payType: '',
          employmentType: '',
          status: 'active',
            joinedAt: now,
            resignAt: null,
          licenseStartAt: null,
          licenseEndAt: null,
          healthInsuranceRecordNumber: '',
          pensionInsuranceRecordNumber: '',
        },
        leaveInfo: [],
        updatedAt: now,
      });

      batch.set(
        affiliationRef,
        {
          uid,
          tid: invitation.tid,
          eid,
          displayName,
          tenantName,
          role,
          status: 'active',
          joinedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      batch.update(invitation.ref, {
        status: 'accepted',
        acceptedBy: uid,
        acceptedEmail: loginEmail,
        acceptedAt: now,
        updatedAt: now,
      });

      await batch.commit();

      return {
        success: true,
        uid,
        loginEmail,
        tid: invitation.tid,
      };
    } catch (error) {
      if (mode === 'create' && userRecord) {
        await admin.auth().deleteUser(userRecord.uid).catch(() => {});
      }
      throw error;
    }
  },
);

async function findInvitationByToken(token: string): Promise<{
  ref: admin.firestore.DocumentReference;
  tid: string;
  data: admin.firestore.DocumentData;
} | null> {
  const tokenHash = hashToken(token);

  const snap = await admin
    .firestore()
    .collectionGroup('invitations')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  const doc = snap.docs[0];
  const tenantRef = doc.ref.parent.parent;

  if (!tenantRef) {
    return null;
  }

  return {
    ref: doc.ref,
    tid: tenantRef.id,
    data: doc.data(),
  };
}

function assertInvitationCanBeAccepted(invitation: admin.firestore.DocumentData): void {
  const status = invitation.status;

  if (status === 'accepted') {
    throw new HttpsError('failed-precondition', 'この招待は既に使用されています。');
  }

  if (status === 'expired' || status === 'revoked' || status === 'failed') {
    throw new HttpsError('failed-precondition', 'この招待は使用できません。');
  }

  if (status !== 'sent' && status !== 'pending') {
    throw new HttpsError('failed-precondition', 'この招待は使用できません。');
  }

  const expiresAt = invitation.expiresAt as admin.firestore.Timestamp | undefined;

  if (!expiresAt || expiresAt.toMillis() <= Date.now()) {
    throw new HttpsError('deadline-exceeded', '招待リンクの有効期限が切れています。');
  }
}

function assertInvitationEmailMatches(
  invitation: admin.firestore.DocumentData,
  inputEmail: string,
): void {
  const invitedEmail = normalizeEmail(invitation.contactEmail);

  if (!invitedEmail || invitedEmail !== inputEmail) {
    throw new HttpsError('permission-denied', '招待されたメールアドレスと一致しません。');
  }
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function mapAuthCreateError(error: any): HttpsError {
  switch (error?.code) {
    case 'auth/email-already-exists':
      return new HttpsError('already-exists', 'このメールアドレスは既に登録されています。');
    case 'auth/weak-password':
      return new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください。');
    case 'auth/invalid-email':
      return new HttpsError('invalid-argument', 'メールアドレスの形式が正しくありません。');
    default:
      return new HttpsError('internal', 'アカウント作成に失敗しました。');
  }
}
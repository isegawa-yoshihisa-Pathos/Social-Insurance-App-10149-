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
  password?: string;
}

export const validateInvitationToken = onCall<ValidateInvitationInput>(
  {
    region: 'asia-northeast1',
    invoker: 'public',
    cors: true,
  },
  async (request) => {
    const token = String(request.data?.token ?? '').trim();
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

    const tenantSnap = await admin.firestore().collection('tenants').doc(invitation.eid).get();
    const tenant = tenantSnap.data();

    const existingUser = await getUserByEmailOrNull(email);

    return {
      eid: invitation.eid,
      tenantName: tenant?.tenantName ?? '',
      name: invitation.data.name ?? '',
      email,
      role: invitation.data.role ?? 'member',
      accountExists: Boolean(existingUser),
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
    const password = String(request.data?.password ?? '');

    if (!email) {
      throw new HttpsError('invalid-argument', 'メールアドレスを入力してください。');
    }

    const invitation = await findInvitationByToken(token);

    if (!invitation) {
      throw new HttpsError('not-found', '招待が見つかりません。');
    }

    assertInvitationCanBeAccepted(invitation.data);
    assertInvitationEmailMatches(invitation.data, email);

    const db = admin.firestore();
    const tenantSnap = await db.collection('tenants').doc(invitation.eid).get();

    if (!tenantSnap.exists) {
      throw new HttpsError('not-found', '事業所が見つかりません。');
    }

    const tenantName = String(tenantSnap.data()?.tenantName ?? '');
    const displayName = String(invitation.data.name ?? '').trim();
    const role = invitation.data.role === 'admin' ? 'admin' : 'member';

    if (!displayName) {
      throw new HttpsError('failed-precondition', '招待情報が不完全です。');
    }

    let userRecord = await getUserByEmailOrNull(email);
    const isNewAccount = !userRecord;

    if (!userRecord) {
      if (!password || password.length < 6) {
        throw new HttpsError('invalid-argument', 'パスワードは6文字以上にしてください。');
      }

      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
          displayName,
        });
      } catch (error: any) {
        throw mapAuthCreateError(error);
      }
    }

    const uid = userRecord.uid;
    const accountRef = db.collection('accounts').doc(uid);
    const affiliationRef = db.collection('affiliations').doc(`${uid}_${invitation.eid}`);

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

    const existingEmployeeId = accountSnap.data()?.affiliations?.[invitation.eid];

    if (existingEmployeeId) {
      throw new HttpsError('already-exists', 'この事業所には既に所属しています。');
    }

    const employeeRef = db
      .collection('tenants')
      .doc(invitation.eid)
      .collection('employees')
      .doc();

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(
      accountRef,
      {
        email,
        currentTenantId: invitation.eid,
        affiliations: {
          [invitation.eid]: employeeRef.id,
        },
        lastView: now,
        updatedAt: now,
        ...(accountSnap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );

    batch.set(employeeRef, {
      uid,
      displayName,
      role,
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    });

    batch.set(
      affiliationRef,
      {
        uid,
        eid: invitation.eid,
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
      acceptedEmail: email,
      acceptedAt: now,
      updatedAt: now,
    });

    await batch.commit();

    return {
      success: true,
      mode: isNewAccount ? 'created' : 'linked',
      uid,
      email,
      eid: invitation.eid,
    };
  },
);

async function findInvitationByToken(token: string): Promise<{
  ref: admin.firestore.DocumentReference;
  eid: string;
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
    eid: tenantRef.id,
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

async function getUserByEmailOrNull(email: string): Promise<admin.auth.UserRecord | null> {
  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
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
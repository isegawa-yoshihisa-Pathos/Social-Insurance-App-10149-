import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';
import { createHash, randomUUID } from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp();
}

let resend: Resend;

interface SendInvitationInput {
  eid: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
}

export const sendInvitationMail = onCall<SendInvitationInput>(
  {
    region: 'asia-northeast1',
    cors: true,
    invoker: 'public',
    secrets: ['RESEND_API_KEY'],
  },
  async (request) => {
    const uid = request.auth?.uid;

    if (!uid) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }

    const { eid, email, name, role } = request.data;

    if (!eid || !email || !name) {
      throw new HttpsError('invalid-argument', '必要なパラメータが不足しています。');
    }

    if (!isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'メールアドレスの形式が正しくありません。');
    }

    if (role !== 'admin' && role !== 'member') {
      throw new HttpsError('invalid-argument', '権限が正しくありません。');
    }

    if (!resend) {
      resend = new Resend(process.env.RESEND_API_KEY);
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new HttpsError('failed-precondition', 'FRONTEND_URL が設定されていません。');
    }

    const defaultTemplateText = `{name} 様

    {tenantName} より、社会保険管理システム「縄文」への招待が届いています。
    以下のボタンからアカウントの初期設定を行い、必要な情報の登録をお願いします。
    ご不明な点がある場合は、管理者（{replyToEmail}）へお問い合わせください。`;

    const db = admin.firestore();

    const affiliationSnap = await db
      .collection('affiliations')
      .doc(`${uid}_${eid}`)
      .get();

    if (!affiliationSnap.exists) {
      throw new HttpsError('permission-denied', 'この事業所への所属がありません。');
    }

    const affiliation = affiliationSnap.data();

    if (affiliation?.role !== 'admin' || affiliation?.status !== 'active') {
      throw new HttpsError('permission-denied', '管理者権限が必要です。');
    }

    const tenantSnap = await db.collection('tenants').doc(eid).get();

    if (!tenantSnap.exists) {
      throw new HttpsError('not-found', '事業所が見つかりません。');
    }

    const invitationSettingSnap = await db
      .collection('tenants')
      .doc(eid)
      .collection('settings')
      .doc('invitationSetting')
      .get();
      
    const templateText = String(
      invitationSettingSnap.data()?.templateText || defaultTemplateText,
    );

    const replyToEmail = String(invitationSettingSnap.data()?.replyToEmail ?? '').trim();
    if (replyToEmail && !isValidEmail(replyToEmail)) {
      throw new HttpsError('invalid-argument', '返信先メールアドレスの形式が正しくありません。');
    }

    const tenant = tenantSnap.data();
    const tenantName = String(tenant?.tenantName ?? '');

    if (!tenantName) {
      throw new HttpsError('failed-precondition', '事業所名が設定されていません。');
    }

    const rawToken = randomUUID();
    const tokenHash = hashToken(rawToken);
    const inviteLink = `${frontendUrl}/invitation?token=${encodeURIComponent(rawToken)}`;
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const inviteRef = db
      .collection('tenants')
      .doc(eid)
      .collection('invitations')
      .doc();

    await inviteRef.set({
      contactEmail: email,
      name,
      tokenHash,
      status: 'pending',
      role,
      invitedBy: uid,
      invitedByEmail: replyToEmail,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      const editableBody = renderTemplate(templateText, {
        name,
        email,
        tenantName,
        replyToEmail,
      });

      const html = `
        <div style="font-family: Arial, sans-serif; color: #333;">
          ${escapeAndConvertNewlines(editableBody)}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${escapeHtml(inviteLink)}" style="background-color: #3f51b5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              アカウント初期設定を行う
            </a>
          </div>

          <p style="font-size: 12px; color: #666;">
            ※このリンクの有効期限は24時間です。<br>
            ※このメールに心当たりがない場合は、このメールを破棄してください。
          </p>
        </div>
      `;

      const emailPayload: Parameters<typeof resend.emails.send>[0] = {
        from: '縄文 社会保険アプリ <onboarding@resend.dev>',
        to: [email],
        subject: `【重要】${tenantName} から社会保険管理システムへの招待`,
        html,
      };

      if (replyToEmail) {
        emailPayload.replyTo = replyToEmail;
      }

      const { data, error } = await resend.emails.send(emailPayload);

      if (error) {
        await inviteRef.update({
          status: 'failed',
          errorMessage: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.error('Resend Mail Error:', error);
        throw new HttpsError('internal', error.message ?? 'メールの送信に失敗しました。');
      }

      await inviteRef.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        resendMessageId: data?.id ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        inviteId: inviteRef.id,
        messageId: data?.id ?? null,
      };
    } catch (error: any) {
      await inviteRef.update({
        status: 'failed',
        errorMessage: error?.message ?? 'メール送信に失敗しました。',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.error('Resend Mail Error:', error);
      throw new HttpsError('internal', 'メールの送信に失敗しました。');
    }
  },
);

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function escapeAndConvertNewlines(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { createHash, randomUUID } from 'crypto';

export const DEFAULT_TEMPLATE_TEXT = `{name} 様

{tenantName} より、社会保険管理システム「縄文」への招待が届いています。
以下のボタンからアカウントの初期設定を行い、必要な情報の登録をお願いします。
ご不明な点がある場合は、管理者（{replyToEmail}）へお問い合わせください。`;

export interface InvitationMailContext {
  templateText: string;
  replyToEmail: string;
  tenantName: string;
  frontendUrl: string;
}

export interface SendVirtualInvitationMailParams {
  tid: string;
  email: string;
  name: string;
  inviteLink: string;
  ctx: InvitationMailContext;
}

export interface SendVirtualInvitationMailResult {
  messageId: string | null;
}

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

export async function loadInvitationMailContext(
  db: admin.firestore.Firestore,
  tid: string,
): Promise<InvitationMailContext> {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error('FAILED_PRECONDITION:FRONTEND_URL が設定されていません。');
  }

  const tenantSnap = await db.collection('tenants').doc(tid).get();
  if (!tenantSnap.exists) {
    throw new Error('NOT_FOUND:事業所が見つかりません。');
  }

  const settingSnap = await db
    .collection('tenants')
    .doc(tid)
    .collection('settings')
    .doc('invitationSetting')
    .get();

  const templateText = String(
    settingSnap.data()?.templateText || DEFAULT_TEMPLATE_TEXT,
  );
  const replyToEmail = String(settingSnap.data()?.replyToEmail ?? '').trim();
  if (replyToEmail && !isValidEmail(replyToEmail)) {
    throw new Error('INVALID_ARGUMENT:返信先メールアドレスの形式が正しくありません。');
  }

  const tenantName = String(tenantSnap.data()?.tenantName ?? '');
  if (!tenantName) {
    throw new Error('FAILED_PRECONDITION:事業所名が設定されていません。');
  }

  return { templateText, replyToEmail, tenantName, frontendUrl };
}

export function createInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomUUID();
  return { rawToken, tokenHash: hashToken(rawToken) };
}

export function buildInviteLink(frontendUrl: string, rawToken: string): string {
  return `${frontendUrl}/invitation?token=${encodeURIComponent(rawToken)}`;
}

/** 現行 virtual-send と同じ送信処理 */
export async function sendVirtualInvitationMail(
  params: SendVirtualInvitationMailParams,
): Promise<SendVirtualInvitationMailResult> {
  const { tid, email, name, inviteLink, ctx } = params;
  const { templateText, replyToEmail, tenantName } = ctx;

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

  const mailRef = admin.firestore().collection('invitation-mails').doc();
  await mailRef.set({
    id: mailRef.id,
    from: '縄文 社会保険アプリ <onboarding@resend.dev>',
    to: [email],
    subject: `【重要】${tenantName} から社会保険管理システムへの招待`,
    replyTo: replyToEmail,
    html,
    opened: false,
    tid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { messageId: mailRef.id ?? null };
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

// --- helpers（既存 virtual-send からそのまま） ---
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
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}
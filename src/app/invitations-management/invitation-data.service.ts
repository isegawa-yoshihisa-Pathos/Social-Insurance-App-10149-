import { EnvironmentInjector, inject, Injectable, runInInjectionContext, signal } from '@angular/core';
import { doc, Firestore, getDoc, Timestamp, collection, query, orderBy, onSnapshot, Unsubscribe } from '@angular/fire/firestore';

export interface InvitationData {
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface InvitationSettingDocument {
  templateText: string;
  emailHeaders: string[];
  nameHeaders: string[];
  replyToEmail?: string;
}

export interface InvitationDoc {
  id: string;
  name: string;
  contactEmail: string;
  role: 'admin' | 'member';
  expiresAt?: Timestamp | null | undefined;
  status: 'queued' | 'sending' | 'failed' | 'sent' | 'accepted' | 'expired';
}

export interface InvitationListItem {
  id: string;
  name: string;
  contactEmail: string;
  role: 'admin' | 'member';
  expiresAt: Date | null;
  status: 'queued' | 'sending' | 'failed' | 'sent' | 'accepted' | 'expired';
}

export const DEFAULT_INVITATION_NAME_HEADERS = ['名前', '氏名', 'name'];
export const DEFAULT_INVITATION_EMAIL_HEADERS = ['メールアドレス', 'メール', 'email', 'mail'];
export const DEFAULT_INVITATION_TEMPLATE_TEXT = `{name} 様

{tenantName} より、社会保険管理システム「縄文」への招待が届いています。
以下のボタンからアカウントの初期設定を行い、必要な情報の登録をお願いします。
ご不明な点がある場合は、管理者（{replyToEmail}）へお問い合わせください。`;

@Injectable({
  providedIn: 'root',
})
export class InvitationDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

  readonly nameHeaders = signal<string[]>([...DEFAULT_INVITATION_NAME_HEADERS]);
  readonly emailHeaders = signal<string[]>([...DEFAULT_INVITATION_EMAIL_HEADERS]);
  readonly templateText = signal<string>(DEFAULT_INVITATION_TEMPLATE_TEXT);
  readonly replyToEmail = signal<string>('');
  readonly settingsLoading = signal(false);

  readonly invitationListLoading = signal(false);
  readonly invitationList = signal<InvitationListItem[]>([]);

  private invitationListUnsub: Unsubscribe | null = null;

  async loadSettings(tid: string): Promise<void> {
    this.settingsLoading.set(true);
    try {
      const doc = await this.loadInvitationDocument(tid);
      if (!doc) {
        this.applyDefaults();
      } else {
        this.applySettings(doc);
      }
    } finally {
      this.settingsLoading.set(false);
    }
  }

  subscribeInvitationList(tid: string): void {
    this.unsubscribeInvitationList();
    this.invitationListLoading.set(true);
    const ref = collection(this.firestore, 'tenants', tid, 'invitations');
    const q = query(ref, orderBy('createdAt', 'desc'));
    this.invitationListUnsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => {
          const raw = doc.data() as InvitationDoc;
          return {
            id: doc.id,
            name: raw.name,
            contactEmail: raw.contactEmail,
            role: raw.role,
            status: raw.status,
            expiresAt:
              raw.expiresAt instanceof Timestamp
                ? raw.expiresAt.toDate()
                : null,
          } satisfies InvitationListItem;
        });
        this.invitationList.set(data);
        this.invitationListLoading.set(false);
      },
      () => this.invitationListLoading.set(false),
    );
  }

  unsubscribeInvitationList(): void {
    this.invitationListUnsub?.();
    this.invitationListUnsub = null;
  }

  extractInvitationsFromCsvText(
    csvText: string,
    emailHeaders: string[],
    nameHeaders: string[],
  ): InvitationData[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return [];
    }
    const headers = lines[0].split(',').map((header) => header.trim());
    const emailIndex = headers.findIndex(
      (header) => emailHeaders.includes(header),
    );
    const nameIndex = headers.findIndex(
      (header) => nameHeaders.includes(header),
    );
    if (emailIndex === -1) {
      throw new Error('CSVにメールアドレス列がありません。');
    }

    if (nameIndex === -1) {
      throw new Error('CSVに名前列がありません。');
    }

    const invitations: InvitationData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map((column) => column.trim());
      const email = columns[emailIndex]?.trim() ?? '';
      const name = columns[nameIndex]?.trim() ?? '';
      if (email && this.isValidEmail(email) && name) {
        invitations.push({ email, name, isAdmin: false });
      }
    }
    return invitations;
  }

  isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  applyDefaults(): void {
    this.nameHeaders.set([...DEFAULT_INVITATION_NAME_HEADERS]);
    this.emailHeaders.set([...DEFAULT_INVITATION_EMAIL_HEADERS]);
    this.templateText.set(DEFAULT_INVITATION_TEMPLATE_TEXT);
    this.replyToEmail.set('');
  }

  applySettings(doc: InvitationSettingDocument): void {
    this.templateText.set(
      doc.templateText?.trim() ? doc.templateText : DEFAULT_INVITATION_TEMPLATE_TEXT,
    );
    this.nameHeaders.set(
      doc.nameHeaders?.length ? [...doc.nameHeaders] : [...DEFAULT_INVITATION_NAME_HEADERS],
    );
    this.emailHeaders.set(
      doc.emailHeaders?.length ? [...doc.emailHeaders] : [...DEFAULT_INVITATION_EMAIL_HEADERS],
    );
    this.replyToEmail.set(doc.replyToEmail ?? '');
  }

  setImportHeaders(nameHeaders: string[], emailHeaders: string[]): void {
    this.nameHeaders.set([...nameHeaders]);
    this.emailHeaders.set([...emailHeaders]);
  }

  addNameHeader(header: string): void {
    const trimmed = header.trim();
    if (!trimmed || this.nameHeaders().includes(trimmed)) {
      return;
    }
    this.nameHeaders.set([...this.nameHeaders(), trimmed]);
  }

  addEmailHeader(header: string): void {
    const trimmed = header.trim();
    if (!trimmed || this.emailHeaders().includes(trimmed)) {
      return;
    }
    this.emailHeaders.set([...this.emailHeaders(), trimmed]);
  }

  deleteNameHeader(header: string): void {
    const next = this.nameHeaders().filter((item) => item !== header);
    if (next.length === 0) {
      return;
    }
    this.nameHeaders.set(next);
  }

  deleteEmailHeader(header: string): void {
    const next = this.emailHeaders().filter((item) => item !== header);
    if (next.length === 0) {
      return;
    }
    this.emailHeaders.set(next);
  }

  setMailSettings(templateText: string, replyToEmail: string): void {
    this.templateText.set(templateText);
    this.replyToEmail.set(replyToEmail);
  }

  reset(): void {
    this.applyDefaults();
  }

  async loadInvitationDocument(tid: string): Promise<InvitationSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'tenants', tid, 'settings', 'invitationSetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as InvitationSettingDocument;
    });
  }
}

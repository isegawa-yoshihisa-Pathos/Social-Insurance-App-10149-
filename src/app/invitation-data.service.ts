import { inject, Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { doc, getDoc } from '@angular/fire/firestore';

export interface InvitationData {
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface InvitationSettingDocument {
  templateText: string;
  emailHeaders: string[];
  nameHeaders: string[];
}

@Injectable({
  providedIn: 'root',
})
export class InvitationDataService {
  private readonly firestore = inject(Firestore);
  private readonly injector = inject(EnvironmentInjector);

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
    if (emailIndex === -1){
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

  async loadInvitationDocument(eid: string): Promise<InvitationSettingDocument | null> {
    return runInInjectionContext(this.injector, async () => {
      const ref = doc(this.firestore, 'establishments', eid, 'settings', 'invitationSetting');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        return null;
      }
      return snap.data() as InvitationSettingDocument;
    });
  }
}

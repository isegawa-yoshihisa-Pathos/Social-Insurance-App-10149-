import { Component, OnInit, inject } from '@angular/core';
import { CurrentEstablishmentService } from '../current-establishment.service';
import { RoutesService } from '../routes.service';
import { Firestore } from '@angular/fire/firestore';
import { collection, getDocs } from '@angular/fire/firestore';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import { MatTabGroup } from '@angular/material/tabs';
import { MatTab } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';
import { MatListItem } from '@angular/material/list';
import { MatFormField } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-invitation-management',
  imports: [MatTabGroup, MatTab, MatButton, MatListItem, MatFormField, MatInput, MatIconButton, MatIcon, MatFormFieldModule, MatInputModule, FormsModule],
  templateUrl: './invitations-management.cmp.html',
  styleUrl: './invitations-management.cmp.css',
})
export class InvitationsManagementCmp implements OnInit {

  eid = '';
  invitations: any[] = [];
  invitationEmails: string[] = [''];

  private readonly currentEstService = inject(CurrentEstablishmentService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);
  private readonly dialog = inject(MatDialog);

  async ngOnInit(): Promise<void> {
    const eid = this.currentEstService.getEstablishment();
    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;

    try {
      const invitationsRef = collection(this.firestore, 'establishments', this.eid, 'invitations');
      const invitations = await getDocs(invitationsRef);
      this.invitations = invitations.docs.map((doc) => doc.data());
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }

  async sendInvitation(): Promise<void> {
    if (this.invitationEmails.length === 0) {
      return;
    }
  }

  async addInvitationEmail(): Promise<void> {
    this.invitationEmails.push('');
  }

  async deleteInvitationEmail(index: number): Promise<void> {
    if (this.invitationEmails.length === 1) {
      this.invitationEmails[0] = '';
      return;
    }
    this.invitationEmails.splice(index, 1);
  }

  attachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const emails = this.extractEmailsFromCsvText(text);
      this.invitationEmails = Array.from(
        new Set([
          ...this.invitationEmails.filter((email) => email.trim()),
          ...emails,
        ]),
      );
      if (this.invitationEmails.length === 0) {
        this.invitationEmails = [''];
      }
      input.value = '';
    };
    reader.onerror = () => {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'CSVファイルの読み込みに失敗しました。' },
      });
    };
    reader.readAsText(file, 'utf-8');
  }
  private extractEmailsFromCsvText(csvText: string): string[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return [];
    }
    const headers = lines[0].split(',').map((header) => header.trim());
    const emailIndex = headers.findIndex(
      (header) => header === 'メールアドレス' || header.toLowerCase() === 'email',
    );
    if (emailIndex === -1) {
      return [];
    }
    return lines
      .slice(1)
      .map((line) => line.split(',')[emailIndex]?.trim())
      .filter((email): email is string => !!email)
      .filter((email) => this.isValidEmail(email));
  }
  private isValidEmail(email: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }
}

import { Component, inject, OnInit, TemplateRef } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MailPreviewCmp } from '../mail-preview/mail-preview.cmp';
import { InvitationMailRecord } from '../mail-preview/mail-preview.model';

@Component({
  selector: 'app-virtual-mail-checker',
  imports: [MatDialogModule, MatButtonModule, MailPreviewCmp],
  templateUrl: './virtual-mail-checker.cmp.html',
  styleUrl: './virtual-mail-checker.cmp.css',
})
export class VirtualMailCheckerCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly dialog = inject(MatDialog);

  mails: InvitationMailRecord[] = [];
  selectedMail: InvitationMailRecord | null = null;

  async ngOnInit(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, 'invitation-mails'));
    this.mails = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as InvitationMailRecord[];
  }

  formatTo(to: string[] |string | undefined): string {
    if (Array.isArray(to)) {
      return to.join(', ');
    }
    return to ?? '';
  }

  openPreview(template: TemplateRef<unknown>, mail: any): void {
    this.selectedMail = mail;
    this.dialog.open(template, {
      width: '720px',
      maxWidth: '90vw',
    });
  }
}

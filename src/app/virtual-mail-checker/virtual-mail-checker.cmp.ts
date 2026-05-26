import { Component, inject, OnInit, TemplateRef } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-virtual-mail-checker',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './virtual-mail-checker.cmp.html',
  styleUrl: './virtual-mail-checker.cmp.css',
})
export class VirtualMailCheckerCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly dialog = inject(MatDialog);

  mails: any[] = [];
  selectedMail: any | null = null;

  async ngOnInit(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, 'invitation-mails'));
    this.mails = snapshot.docs.map((doc) => doc.data());
  }

  openPreview(template: TemplateRef<unknown>, mail: any): void {
    this.selectedMail = mail;
    this.dialog.open(template, {
      width: '720px',
      maxWidth: '90vw',
    });
  }
}

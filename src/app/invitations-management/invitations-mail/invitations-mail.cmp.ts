import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CurrentTenantService } from '../../current-tenant.service';
import { RoutesService } from '../../routes.service';
import { Firestore } from '@angular/fire/firestore';
import { MatDialog } from '@angular/material/dialog';
import { InvitationDataService, InvitationData } from '../invitation-data.service';
import { FunctionsService } from '../../functions.service';
import { collection, getDocs } from '@angular/fire/firestore';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InvitationsListCmp } from './invitations-list/invitations-list.cmp';
import { HelpContentCmp } from '../../help-content/help-content.cmp';

@Component({
  selector: 'app-invitations-mail',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatIconModule, MatTooltipModule, FormsModule, MatProgressSpinnerModule, HelpContentCmp, InvitationsListCmp],
  templateUrl: './invitations-mail.cmp.html',
  styleUrls: ['./invitations-mail.cmp.css', '../invitations-management.cmp.css'],
})
export class InvitationsMailCmp implements OnInit{
  @ViewChild(InvitationsListCmp) invitationsListCmp!: InvitationsListCmp;
  tid = '';
  invitations: any[] = [];
  invitationsData: InvitationData[] = [{ email: '', name: '', isAdmin: false }];
  templateText: string = '';

  sendBusy = false;

  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);
  private readonly dialog = inject(MatDialog);
  private readonly invitationDataService = inject(InvitationDataService);
  private readonly functionsService = inject(FunctionsService);

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }
    this.tid = tid;

    try {
      await this.invitationDataService.loadSettings(tid);
      const invitationsRef = collection(this.firestore, 'tenants', this.tid, 'invitations');
      const invitations = await getDocs(invitationsRef);
      this.invitations = invitations.docs.map((doc) => doc.data());
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }

  async sendInvitation(): Promise<void> {
    const validInvitations = this.invitationsData
    .map((invitation) => ({
      name: invitation.name.trim(),
      email: invitation.email.trim(),
      role: invitation.isAdmin ? 'admin' : 'member',
    }))
    .filter((invitation) => invitation.name || invitation.email);
    const hasInvalid = validInvitations.some(
      (invitation) =>
        !invitation.name ||
        !this.invitationDataService.isValidEmail(invitation.email),
    );
    if (validInvitations.length === 0 || hasInvalid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '名前とメールアドレスを正しく入力してください。' },
      });
      return;
    }
    this.sendBusy = true;

    const failed: { email: string; message: string }[] = [];
    let successCount = 0;

    for (const invitation of validInvitations) {
      try {
        await this.functionsService.sendInvitationMail({
          tid: this.tid,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role as 'admin' | 'member',
        });
        successCount++;
      } catch (error) {
        failed.push({ 
          email: invitation.email, 
          message: mapFirebaseError(error) 
        });
      }
    }

    this.sendBusy = false;

    const total = validInvitations.length;
    if (failed.length === 0) {
      this.dialog.open(SuccessDialogCmp, {
        data: { message: `招待メールを ${successCount}/${total} 件送信しました。` },
      });
    } else {
      const detail = failed.map(f => `・${f.email}: ${f.message}`).join('\n');
      this.dialog.open(ErrorDialogCmp, {
        data: {
          message:
            `${successCount}/${total} 件送信しました。\n\n` +
            `送信に失敗したメール：\n${detail}`,
        },
      });
    }

    await this.invitationsListCmp?.reload();
  }

  async addInvitationEmail(): Promise<void> {
    this.invitationsData.push({ email: '', name: '', isAdmin: false });
  }

  async deleteInvitationEmail(index: number): Promise<void> {
    if (this.invitationsData.length === 1) {
      this.invitationsData[0] = { email: '', name: '', isAdmin: false };
      return;
    }
    this.invitationsData.splice(index, 1);
  }

  attachFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const invitations = this.invitationDataService.extractInvitationsFromCsvText(text, this.invitationDataService.emailHeaders(), this.invitationDataService.nameHeaders());
        const map = new Map<string, InvitationData>();
        for (const invitation of [...this.invitationsData, ...invitations]) {
          const email = invitation.email.trim();
          if (!email) continue;
          
          map.set(email, {
            email,
            name: invitation.name.trim(),
            isAdmin: invitation.isAdmin,
          });
        }

        this.invitationsData = Array.from(map.values());

        if (this.invitationsData.length === 0) {
          this.invitationsData = [{ email: '', name: '', isAdmin: false }];
        }
      } catch (error) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: mapFirebaseError(error) },
        });
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }
}

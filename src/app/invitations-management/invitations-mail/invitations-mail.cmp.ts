import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CurrentTenantService } from '../../current-tenant.service';
import { RoutesService } from '../../routes.service';
import { MatDialog } from '@angular/material/dialog';
import { InvitationDataService, InvitationData } from '../invitation-data.service';
import { FunctionsService } from '../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HelpContentCmp } from '../../help-content/help-content.cmp';
import { InvitationsListCmp } from './invitations-list/invitations-list.cmp';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-invitations-mail',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatIconModule, MatTooltipModule, FormsModule, MatProgressSpinnerModule, HelpContentCmp, InvitationsListCmp],
  templateUrl: './invitations-mail.cmp.html',
  styleUrls: ['./invitations-mail.cmp.css', '../invitations-management.cmp.css'],
})
export class InvitationsMailCmp implements OnInit{
  tid = '';
  invitationsData: InvitationData[] = [{ email: '', name: '', isAdmin: false }];
  templateText: string = '';

  sendBusy = false;

  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  private readonly invitationDataService = inject(InvitationDataService);
  private readonly functionsService = inject(FunctionsService);
  private readonly snackBar = inject(MatSnackBar);

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }
    this.tid = tid;

    try {
      await this.invitationDataService.loadSettings(tid);
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
        role: (invitation.isAdmin ? 'admin' : 'member') as 'admin' | 'member',
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
    try {
      const { total } = await this.functionsService.startInvitationMailBatch({
        tid: this.tid,
        items: validInvitations,
      });
      this.snackBar.open(
        `${total}件の招待送信を開始しました。進捗は一覧、完了は通知で確認できます。`,
        '閉じる',
        { duration: 6000 },
      );
      // 入力クリア（任意）
      this.invitationsData = [{ email: '', name: '', isAdmin: false }];
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.sendBusy = false;
    }
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

import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  ApplicationDataService,
  PendingApplication,
} from '../../application-data.service';
import { CurrentTenantService } from '../../../current-tenant.service';
import {
  formatLeavePeriod,
  leaveTypeLabel,
} from '../../../employee-leave.util';
import { formatJapaneseDate, toFormDate } from '../../../date-utils';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';

@Component({
  selector: 'app-accept-application',
  imports: [MatButtonModule],
  templateUrl: './accept-application.cmp.html',
  styleUrl: './accept-application.cmp.css',
})
export class AcceptApplicationCmp implements OnInit {
  private readonly applicationDataService = inject(ApplicationDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  leaveApplications: PendingApplication[] = [];
  resignApplications: PendingApplication[] = [];
  readonly leaveTypeLabel = leaveTypeLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  leavePeriod(application: PendingApplication): string {
    const details = application.leaveDetails;
    if (!details) return '';
    return formatLeavePeriod(
      toFormDate(details.startAt),
      toFormDate(details.endAt),
    );
  }

  resignDate(application: PendingApplication): string {
    const details = application.resignDetails;
    if (!details) return '';
    return formatJapaneseDate(toFormDate(details.resignAt));
  }

  appliedAt(application: PendingApplication): string {
    return formatJapaneseDate(toFormDate(application.createdAt));
  }

  async approve(application: PendingApplication): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = application.id;
    try {
      if (application.type === 'leave') {
        await this.applicationDataService.approveLeaveApplication(tid, application.id);
      } else if (application.type === 'resign') {
        await this.applicationDataService.approveResignApplication(tid, application.id);
      } else {
        throw new Error('承認できない申請です。');
      }

      const message =
        application.type === 'resign'
          ? '退職申請を承認しました。'
          : '休暇申請を承認しました。';
      this.dialog.open(SuccessDialogCmp, { data: { message } });
      await this.reload();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  async reject(application: PendingApplication): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = application.id;
    try {
      await this.applicationDataService.rejectApplication(tid, application.id);
      const message =
        application.type === 'resign'
          ? '退職申請を却下しました。'
          : '休暇申請を却下しました。';
      this.dialog.open(SuccessDialogCmp, { data: { message } });
      await this.reload();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  private async reload(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.loading = true;
    try {
      const [leaveApplications, resignApplications] = await Promise.all([
        this.applicationDataService.listPendingLeaveApplications(tid),
        this.applicationDataService.listPendingResignApplications(tid),
      ]);
      this.leaveApplications = leaveApplications;
      this.resignApplications = resignApplications;
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}

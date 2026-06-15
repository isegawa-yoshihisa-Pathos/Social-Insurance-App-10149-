import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  ApplicationDataService,
  PendingApplication,
} from '../../application-data.service';
import { formatApplyMonthLabel } from '../../allowance-application.util';
import { CurrentTenantService } from '../../../current-tenant.service';
import {
  formatLeavePeriod,
  leaveTypeLabel,
} from '../../../employee-leave.util';
import { formatJapaneseDate, toFormDate } from '../../../date-utils';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import { Format } from '../../../format-number-jp';

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
  allowanceApplications: PendingApplication[] = [];
  leaveApplications: PendingApplication[] = [];
  resignApplications: PendingApplication[] = [];
  personalInfoApplications: PendingApplication[] = [];
  dependentsApplications: PendingApplication[] = [];
  readonly leaveTypeLabel = leaveTypeLabel;
  readonly formatApplyMonthLabel = formatApplyMonthLabel;
  readonly Format = Format;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  isPending(application: PendingApplication): boolean {
    return application.status === 'pending';
  }

  formatStatus(status: PendingApplication['status']): string {
    return status === 'pending' ? '未承認' : status === 'approved' ? '承認済み' : '却下';
  }

  allowanceTypeLabel(application: PendingApplication): string {
    return application.allowanceDetails?.allowanceTypeLabel
      ?? application.allowanceDetails?.allowanceType
      ?? '';
  }

  applyMonthLabel(application: PendingApplication): string {
    const yyyyMm = application.allowanceDetails?.applyYyyyMm;
    return yyyyMm ? formatApplyMonthLabel(yyyyMm) : '';
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
      if (application.type === 'allowance') {
        await this.applicationDataService.approveAllowanceApplication(tid, application.id);
      } else if (application.type === 'leave') {
        await this.applicationDataService.approveLeaveApplication(tid, application.id);
      } else if (application.type === 'resign') {
        await this.applicationDataService.approveResignApplication(tid, application.id);
      } else if (application.type === 'personal_info') {
        await this.applicationDataService.approvePersonalInfoApplication(tid, application.id);
      } else if (application.type === 'dependents') {
        await this.applicationDataService.approveDependentsApplication(tid, application.id);
      } else {
        throw new Error('承認できない申請です。');
      }

      const message = this.approveSuccessMessage(application);
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
      const message = this.rejectSuccessMessage(application);
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

  async deleteApplication(application: PendingApplication): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.busyId = application.id;
    try {
      await this.applicationDataService.deleteApplication(tid, application.id);
      this.dialog.open(SuccessDialogCmp, {
        data: { message: '申請を削除しました。' },
      });
      await this.reload();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busyId = null;
    }
  }

  dependentsCount(application: PendingApplication): number {
    return application.dependentsDetails?.dependentsInfo?.length ?? 0;
  }

  private approveSuccessMessage(application: PendingApplication): string {
    if (application.type === 'allowance') {
      return '諸手当申請を承認しました。給与・手当データは別途手動で反映してください。';
    }
    if (application.type === 'resign') {
      return '退職申請を承認しました。';
    }
    if (application.type === 'personal_info') {
      return '基本情報変更申請を承認しました。';
    }
    if (application.type === 'dependents') {
      return '扶養家族変更申請を承認しました。';
    }
    return '休暇申請を承認しました。';
  }

  private rejectSuccessMessage(application: PendingApplication): string {
    if (application.type === 'allowance') {
      return '諸手当申請を却下しました。';
    }
    if (application.type === 'resign') {
      return '退職申請を却下しました。';
    }
    if (application.type === 'personal_info') {
      return '基本情報変更申請を却下しました。';
    }
    if (application.type === 'dependents') {
      return '扶養家族変更申請を却下しました。';
    }
    return '休暇申請を却下しました。';
  }

  private async reload(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;

    this.loading = true;
    try {
      const [
        allowanceApplications,
        leaveApplications,
        resignApplications,
        personalInfoApplications,
        dependentsApplications,
      ] = await Promise.all([
        this.applicationDataService.listAllowanceApplications(tid),
        this.applicationDataService.listLeaveApplications(tid),
        this.applicationDataService.listResignApplications(tid),
        this.applicationDataService.listPersonalInfoApplications(tid),
        this.applicationDataService.listDependentsApplications(tid),
      ]);
      this.allowanceApplications = allowanceApplications;
      this.leaveApplications = leaveApplications;
      this.resignApplications = resignApplications;
      this.personalInfoApplications = personalInfoApplications;
      this.dependentsApplications = dependentsApplications;
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import {
  ApplicationDataService,
} from '../application-data.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { ApplicationDocument } from '../application-document';
import {
  formatLeavePeriod,
  leaveTypeLabel,
} from '../../employee-leave.util';
import { formatJapaneseDate, toFormDate } from '../../date-utils';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';

@Component({
  selector: 'app-application-list',
  imports: [MatButtonModule],
  templateUrl: './application-list.cmp.html',
  styleUrl: './application-list.cmp.css',
})
export class ApplicationListCmp implements OnInit {
  private readonly applicationDataService = inject(ApplicationDataService);
  private readonly tenant = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  busyId: string | null = null;
  applications: ApplicationDocument[] = [];
  readonly leaveTypeLabel = leaveTypeLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  leavePeriod(application: ApplicationDocument): string {
    const details = application.leaveDetails;
    if (!details) return '';
    return formatLeavePeriod(
      toFormDate(details.startAt),
      toFormDate(details.endAt),
    );
  }

  resignDate(application: ApplicationDocument): string {
    const details = application.resignDetails;
    if (!details) return '';
    return formatJapaneseDate(toFormDate(details.resignAt));
  }

  appliedAt(application: ApplicationDocument): string {
    return formatJapaneseDate(toFormDate(application.createdAt));
  }

  formatStatus(status: ApplicationDocument['status']): string {
    return status === 'pending' ? '未承認' : status === 'approved' ? '承認' : '却下';
  }

  private async reload(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;
    const eid = this.tenant.currentEmployeeId();
    if (!eid) return;

    this.loading = true;
    try {
      this.applications = await this.applicationDataService.listApplications(tid, eid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }
}

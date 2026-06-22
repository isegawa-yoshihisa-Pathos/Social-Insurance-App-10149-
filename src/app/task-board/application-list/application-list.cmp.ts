import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  ApplicationDataService,
  ApplicationListItem,
} from '../application-data.service';
import { CurrentTenantService } from '../../current-tenant.service';
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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  busyId: string | null = null;
  applications: ApplicationListItem[] = [];
  readonly leaveTypeLabel = leaveTypeLabel;

  async ngOnInit(): Promise<void> {
    await this.reload();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event.urlAfterRedirects.startsWith('/task-board/personal')) {
          void this.reload();
        }
      });
  }

  leavePeriod(application: ApplicationListItem): string {
    const details = application.leaveDetails;
    if (!details) return '';
    return formatLeavePeriod(
      toFormDate(details.startAt),
      toFormDate(details.endAt),
    );
  }

  resignDate(application: ApplicationListItem): string {
    const details = application.resignDetails;
    if (!details) return '';
    return formatJapaneseDate(toFormDate(details.resignAt));
  }

  appliedAt(application: ApplicationListItem): string {
    return formatJapaneseDate(toFormDate(application.createdAt));
  }

  formatStatus(status: ApplicationListItem['status']): string {
    return status === 'pending' ? '未承認' : status === 'approved' ? '承認' : '却下';
  }

  statusBadgeClass(status: ApplicationListItem['status']): string {
    if (status === 'approved') {
      return 'status-badge status-approved';
    }
    if (status === 'rejected') {
      return 'status-badge status-rejected';
    }
    return 'status-badge status-pending';
  }

  applicationTypeLabel(application: ApplicationListItem): string {
    switch (application.type) {
      case 'leave':
        return '休暇申請';
      case 'resign':
        return '退職申請';
      case 'allowance':
        return '諸手当申請';
      case 'personal_info':
        return '基本情報変更申請';
      case 'dependents':
        return '扶養家族変更申請';
      default:
        return '申請';
    }
  }

  private async reload(): Promise<void> {
    const tid = this.tenant.currentTid();
    if (!tid) return;
    const eid = this.tenant.currentEid();
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

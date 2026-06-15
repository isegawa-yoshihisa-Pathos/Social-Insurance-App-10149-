import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../current-tenant.service';
import { AuditLogListItem, LogDataService } from './log-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';

@Component({
  selector: 'app-log-management',
  imports: [MatButtonModule, MatProgressSpinnerModule, MatTableModule],
  templateUrl: './log-management.cmp.html',
  styleUrl: './log-management.cmp.css',
})
export class LogManagementCmp implements OnInit {
  readonly logDataService = inject(LogDataService);
  private readonly tenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  logs: AuditLogListItem[] = [];
  expandedId: string | null = null;

  readonly displayedColumns = [
    'createdAt',
    'actor',
    'target',
    'action',
    'summary',
    'detail',
  ];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const tid = this.tenantService.currentTid();
    if (!tid) return;

    this.loading = true;
    try {
      this.logs = await this.logDataService.listRecent(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  toggleDetail(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  formatTimestamp(item: AuditLogListItem): string {
    return this.logDataService.formatTimestamp(item.doc.createdAt);
  }

  actorLabel(item: AuditLogListItem): string {
    return item.doc.actorDisplayName || item.doc.actorUid;
  }

  targetLabel(item: AuditLogListItem): string {
    return this.logDataService.targetLabel(item);
  }

  actionLabel(item: AuditLogListItem): string {
    return this.logDataService.actionLabel(item.doc.action);
  }

  hasChanges(item: AuditLogListItem): boolean {
    return (item.doc.changes?.length ?? 0) > 0;
  }
}

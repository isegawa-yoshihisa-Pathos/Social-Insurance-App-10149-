import { Component, inject, ViewChild, effect } from '@angular/core';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { InvitationListItem, InvitationDataService } from '../../invitation-data.service';
import { CurrentTenantService } from '../../../current-tenant.service';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import { ErrorDialogCmp } from '../../../error-dialog/error-dialog.cmp';
import { FunctionsService } from '../../../functions.service';

@Component({
  selector: 'app-invitations-list',
  imports: [MatTableModule, MatSortModule, MatTooltipModule, MatCheckboxModule, MatMenuModule],
  templateUrl: './invitations-list.cmp.html',
  styleUrl: './invitations-list.cmp.css',
})
export class InvitationsListCmp {
  private readonly dialog = inject(MatDialog);
  readonly invitationDataService = inject(InvitationDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly functionsService = inject(FunctionsService);

  selectedIds = new Set<string>();
  tid = '';

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<InvitationListItem>([]);
  displayedColumns = ['selected', 'name', 'contactEmail', 'role', 'expiresAt', 'status'];

  constructor() {
    effect((onCleanup) => {
      const tid = this.currentTenantService.currentTid();
      if (!tid) {
        this.invitationDataService.unsubscribeInvitationList();
        this.selectedIds.clear();
        this.dataSource.data = [];
        return;
      }
      this.tid = tid;
      this.invitationDataService.subscribeInvitationList(this.tid);
      onCleanup(() => this.invitationDataService.unsubscribeInvitationList());
    });

    effect(() => {
      this.dataSource.data = this.invitationDataService.invitationList();
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  isAllSelected(): boolean {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    return rows.length > 0 && rows.every((r) => this.selectedIds.has(r.id));
  }

  toggleAll(checked: boolean): void {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (checked) {
      rows.forEach((r) => this.selectedIds.add(r.id));
    } else {
      rows.forEach((r) => this.selectedIds.delete(r.id));
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  private resolveTargetIds(id: string): string[] {
    if (this.selectedIds.size === 0) {
      return [id];
    }
    return this.selectedIds.has(id) 
      ? [...this.selectedIds]
      : [id];
  }

  async resendInvitations(id: string): Promise<void> {
    const ids = this.resolveTargetIds(id);
    if (ids.length === 0) return;

    const targets = this.invitationDataService.invitationList().filter(item => ids.includes(item.id));
    if (targets.length === 0) return;

    const items = targets.map(t => ({
      email: t.contactEmail,
      name: t.name,
      role: t.role
    }));

    try {
      const { total } = await this.functionsService.startInvitationMailBatch({
        tid: this.tid,
        items
      });

      await this.invitationDataService.deleteInvitations(ids, this.tid);

      this.dialog.open(SuccessDialogCmp, {
        data: { message: `${total}件の招待メールを再送信しました。` },
      });

      ids.forEach(deletedId => this.selectedIds.delete(deletedId));
      this.selectedIds = new Set(this.selectedIds);

    } catch (error) {
      console.error('再送信エラー:', error);
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '招待の再送信に失敗しました。' },
      });
    }
  }

  async deleteInvitations(id: string): Promise<void> {
    const ids = this.resolveTargetIds(id);
    if (ids.length === 0) return;

    try {
      await this.invitationDataService.deleteInvitations(ids, this.tid);
      
      this.dialog.open(SuccessDialogCmp, {
        data: { message: `${ids.length}件の招待が削除されました` },
      });
      ids.forEach(deletedId => this.selectedIds.delete(deletedId));
      this.selectedIds = new Set(this.selectedIds);

    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '招待を削除できませんでした。' },
      });
    }
  }

  roleLabel(role: InvitationListItem['role']): string {
    return role === 'admin' ? '管理者' : 'メンバー';
  }

  statusLabel(status: InvitationListItem['status']): string {
    switch (status) {
      case 'sent':
        return '送信';
      case 'queued':
        return '待機';
      case 'sending':
        return '送信中';
      case 'accepted':
        return '登録済み';
      case 'expired':
        return '期限切れ';
      case 'failed':
        return '失敗';
      default:
        return '不明';
    }
  }

  isAlertClass(status: InvitationListItem['status']): boolean {
    return status === 'expired' || status === 'failed';
  }

  formatExpiresAt(expiresAt?: Date): string {
    if (!expiresAt) {
      return '-';
    }

    return expiresAt.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
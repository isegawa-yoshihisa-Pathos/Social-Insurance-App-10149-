import { Component, inject, ViewChild, effect } from '@angular/core';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InvitationListItem, InvitationDataService } from '../../invitation-data.service';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-invitations-list',
  imports: [MatTableModule, MatSortModule, MatTooltipModule],
  templateUrl: './invitations-list.cmp.html',
  styleUrl: './invitations-list.cmp.css',
})
export class InvitationsListCmp {
  readonly invitationDataService = inject(InvitationDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<InvitationListItem>([]);
  displayedColumns = ['name', 'contactEmail', 'role', 'expiresAt', 'status'];

  constructor() {
    effect(async () => {
      const tid = this.currentTenantService.currentTid();
      if (!tid) {
        this.dataSource.data = [];
        this.invitationDataService.invitationListLoading.set(false);
        return;
      }
      await this.invitationDataService.loadInvitationList(tid);
      this.dataSource.data = this.invitationDataService.invitationList();
      this.invitationDataService.invitationListLoading.set(false);
    })
  }

  selectInvitation(id: string) {
    this.routesService.redirectToInvitationDetail(id);
  }

  roleLabel(role: InvitationListItem['role']): string {
    return role === 'admin' ? '管理者' : 'メンバー';
  }

  statusLabel(status: InvitationListItem['status']): string {
    switch (status) {
      case 'sent':
        return '送信';
      case 'pending':
        return '未使用';
      case 'accepted':
        return '登録済み';
      case 'expired':
        return '期限切れ';
      case 'revoked':
        return '取り消し';
      case 'failed':
        return '失敗';
      default:
        return '不明';
    }
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
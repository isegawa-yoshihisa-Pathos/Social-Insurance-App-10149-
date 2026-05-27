import { Component, OnInit, inject, ViewChild, effect } from '@angular/core';
import { Firestore, collection, getDocs, Timestamp, query, orderBy } from '@angular/fire/firestore';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrentTenantService } from '../../../current-tenant.service';

interface InvitationDoc {
  name: string;
  contactEmail: string;
  role: 'admin' | 'member';
  expiresAt?: Timestamp | null | undefined;
  status: string;
}

interface InvitationListItem {
  name: string;
  contactEmail: string;
  role: 'admin' | 'member';
  expiresAt: Date | null;
  status: string;
}

@Component({
  selector: 'app-invitations-list',
  imports: [MatTableModule, MatSortModule, MatTooltipModule],
  templateUrl: './invitations-list.cmp.html',
  styleUrl: './invitations-list.cmp.css',
})
export class InvitationsListCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly currentTenantService = inject(CurrentTenantService);

  tid = '';

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<InvitationListItem>([]);
  displayedColumns = ['name', 'contactEmail', 'role', 'expiresAt', 'status'];

  loading = true;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async reload(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.tid = this.currentTenantService.currentTid() ?? '';
    if (!this.tid) {
      this.loading = false;
      return;
    }

    const invitationsRef = collection(this.firestore, 'tenants', this.tid, 'invitations');
    const q = query(invitationsRef, orderBy('createdAt', 'asc'));
    const invitations = await getDocs(q);

    const data = invitations.docs.map((doc) => {
      const rawData = doc.data() as InvitationDoc;

      return {
        ...rawData,
        expiresAt: rawData.expiresAt instanceof Timestamp ? rawData.expiresAt.toDate() : null
      } as InvitationListItem;
    });

    this.dataSource.data = data;

    this.loading = false;
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
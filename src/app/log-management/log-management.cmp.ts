import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../current-tenant.service';
import { AuditLogListItem, LogDataService } from './log-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import type { AuditLogAction } from './log-document';
import {
  AuditLogSearchCriteria,
  AuditLogSortColumn,
  auditLogTargetKindLabel,
  getAuditLogSortValue,
  matchesAuditLogSearch,
} from './audit-log-list.util';
import { formatAuditLogCategory } from '../../../shared/audit-log-display.util';

@Component({
  selector: 'app-log-management',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './log-management.cmp.html',
  styleUrl: './log-management.cmp.css',
})
export class LogManagementCmp implements OnInit {
  readonly logDataService = inject(LogDataService);
  private readonly tenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);

  loading = false;
  expandedId: string | null = null;
  categoryOptions: string[] = [];

  searchKeyword = '';
  filterAction: AuditLogAction | '' = '';
  filterCategory = '';

  readonly dataSource = new MatTableDataSource<AuditLogListItem>([]);

  readonly displayedColumns = [
    'createdAt',
    'actor',
    'target',
    'action',
    'category',
    'summary',
    'detail',
  ];

  readonly actionFilterOptions: { value: AuditLogAction | ''; label: string }[] = [
    { value: '', label: 'すべて' },
    { value: 'create', label: '作成' },
    { value: 'update', label: '更新' },
    { value: 'delete', label: '削除' },
  ];

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (!sort) {
      return;
    }
    this.dataSource.sort = sort;
    if (!sort.active) {
      sort.active = 'createdAt';
      sort.direction = 'desc';
    }
  }

  constructor() {
    this.dataSource.filterPredicate = (item, filter) => {
      const criteria = JSON.parse(filter) as AuditLogSearchCriteria;
      return matchesAuditLogSearch(item, criteria, this.itemLabels(item));
    };

    this.dataSource.sortingDataAccessor = (item, property) => {
      const value = getAuditLogSortValue(
        item,
        property as AuditLogSortColumn,
        this.itemLabels(item),
      );
      return typeof value === 'number' ? value : value.toLowerCase();
    };
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  get hasLoadedLogs(): boolean {
    return this.dataSource.data.length > 0;
  }

  get hasVisibleLogs(): boolean {
    return this.dataSource.filteredData.length > 0;
  }

  async reload(): Promise<void> {
    const tid = this.tenantService.currentTid();
    if (!tid) return;

    this.loading = true;
    this.expandedId = null;
    try {
      const logs = await this.logDataService.listRecent(tid);
      this.dataSource.data = logs;
      this.categoryOptions = [...new Set(logs.map((item) => item.doc.category))].sort();
      this.applyFilter();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  applyFilter(): void {
    this.dataSource.filter = JSON.stringify({
      keyword: this.searchKeyword.trim().toLowerCase(),
      action: this.filterAction,
      category: this.filterCategory,
    } satisfies AuditLogSearchCriteria);
    this.expandedId = null;
  }

  clearFilters(): void {
    this.searchKeyword = '';
    this.filterAction = '';
    this.filterCategory = '';
    this.applyFilter();
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

  categoryLabel(item: AuditLogListItem): string {
    return formatAuditLogCategory(item.doc.category);
  }

  hasChanges(item: AuditLogListItem): boolean {
    return (item.doc.changes?.length ?? 0) > 0;
  }

  formatChangeField(field: string): string {
    return this.logDataService.formatChangeField(field);
  }

  formatCategory(category: string): string {
    return this.logDataService.formatCategory(category);
  }

  private itemLabels(item: AuditLogListItem): {
    actionLabel: string;
    targetLabel: string;
    targetKindLabel: string;
    categoryLabel: string;
  } {
    return {
      actionLabel: this.actionLabel(item),
      targetLabel: this.targetLabel(item),
      targetKindLabel: auditLogTargetKindLabel(item.doc.targetKind),
      categoryLabel: this.categoryLabel(item),
    };
  }
}

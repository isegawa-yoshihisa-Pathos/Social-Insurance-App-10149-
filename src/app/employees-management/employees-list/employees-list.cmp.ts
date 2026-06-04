import { Component, computed, effect, inject, ViewChild } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { AuthService } from '../../auth.service';
import { EmployeesManagementDataService } from '../employees-management-data.service';
import {
  EmployeeListColumnKey,
  EmployeeListRow,
  EMPLOYEE_LIST_COLUMN_LABELS,
} from './employee-list-columns';
import { EmployeeDocument } from '../../employee-document';
import {
  BulkColumnEditDialogCmp,
  BulkColumnEditDialogData,
} from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue } from './employees-bulk-edit.types';
import { EmployeesListBulkEditService } from './employees-list-bulk-edit.service';
import { toEmployeeListRow } from './employee-list-row.mapper';
import { EmployeesListImportService } from './employees-list-import.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { HelpContentCmp } from '../../help-content/help-content.cmp';

@Component({
  selector: 'app-employees-list',
  imports: [MatTableModule, MatSortModule, FormsModule, MatSelectModule, MatInputModule, MatCheckboxModule, MatIconModule, MatButtonModule, MatTooltipModule, HelpContentCmp],
  templateUrl: './employees-list.cmp.html',
  styleUrl: './employees-list.cmp.css',
})
export class EmployeesListCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly authService = inject(AuthService);
  private readonly dataService = inject(EmployeesManagementDataService);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(EmployeesListBulkEditService);
  private readonly importService = inject(EmployeesListImportService);

  readonly employeeListColumnLabels = EMPLOYEE_LIST_COLUMN_LABELS;
  readonly visibleColumns = computed(() => this.dataService.visibleColumns());
  readonly tableColumns = computed(() => ['selected', ...this.visibleColumns()]);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<EmployeeListRow>([]);
  loading = true;
  bulkSaving = false;

  searchTargetColumn: EmployeeListColumnKey = 'employeeId';
  searchQuery: string = '';

  selectedEids = new Set<string>();

  constructor() {
    effect(async () => {
      const tid = this.currentTenantService.currentTid();
      if (!tid) {
        this.dataSource.data = [];
        this.selectedEids.clear();
        this.loading = false;
        return;
      }
      await Promise.all([
        this.loadEmployees(tid),
        this.dataService.loadListSettings(tid),
      ]);
    });

    this.dataSource.filterPredicate = (data: EmployeeListRow, filter: string) => {
      const searchCondition = JSON.parse(filter) as {
        column: keyof EmployeeListRow;
        query: string;
      };

      const value = data[searchCondition.column as keyof EmployeeListRow];
      return value ? String(value).toLowerCase().includes(searchCondition.query) : false;
    };
  }

  private async loadEmployees(tid: string): Promise<void> {
    this.loading = true;
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const data = employees.docs.map((snap) =>
      toEmployeeListRow(snap.id, snap.data() as Partial<EmployeeDocument>),
    );
    this.dataSource.data = data;
    const alive = new Set(data.map((r) => r.eid));
    this.selectedEids = new Set([...this.selectedEids].filter((eid) => alive.has(eid)));

    this.loading = false;
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery.toLowerCase(),
    });
  }

  isSelected(eid: string): boolean {
    return this.selectedEids.has(eid);
  }

  toggleSelection(eid: string, checked: boolean): void {
    if (checked) {
      this.selectedEids.add(eid);
    } else {
      this.selectedEids.delete(eid);
    }
    this.selectedEids = new Set(this.selectedEids);
  }

  isAllSelectedInView(): boolean {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    return rows.length > 0 && rows.every((r) => this.selectedEids.has(r.eid));
  }

  toggleAllInView(checked: boolean): void {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (checked) {
      rows.forEach((r) => this.selectedEids.add(r.eid));
    } else {
      rows.forEach((r) => this.selectedEids.delete(r.eid));
    }
    this.selectedEids = new Set(this.selectedEids);
  }

  onCellClick(row: EmployeeListRow, col: EmployeeListColumnKey): void {
    if (col === 'displayName') {
      this.routesService.redirectToEmployeeEmployDetail(row.eid);
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    if (targetEids.length === 1) {
      this.openBulkEditDialog(col as BulkEditableColumn, row[col], targetEids, row.displayName);
      return;
    }
    this.openBulkEditDialog(col as BulkEditableColumn, row[col], targetEids);
  }

  private resolveTargetEids(eid: string): string[] {
    if (this.selectedEids.size === 0) {
      return [eid];
    }

    return this.selectedEids.has(eid) 
      ? [...this.selectedEids]
      : [eid];
  }

  private openBulkEditDialog(column: BulkEditableColumn, initialValue: unknown, targetEids: string[], displayName?: string): void {
    const dialogRef = this.dialog.open<BulkColumnEditDialogCmp, BulkColumnEditDialogData, BulkEditValue | undefined>(BulkColumnEditDialogCmp, {
      width: '420px',
      data: {
        column,
        label: this.employeeListColumnLabels[column],
        selectedCount: targetEids.length,
        initialValue,
        displayName: displayName ?? undefined,
      },
    });

    dialogRef.afterClosed().subscribe(async (value: BulkEditValue | undefined) => {
      if (value === undefined) return;
      await this.applyBulkEdit(column, value, targetEids);
    });
  }

  private async applyBulkEdit(column: BulkEditableColumn, value: BulkEditValue, targetEids: string[]): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid || targetEids.length === 0) return;
    this.bulkSaving = true;
    try {
      await this.bulkEditService.applyBulkEdit(tid, targetEids, column, value);
      await this.loadEmployees(tid);
    } finally {
      this.bulkSaving = false;
    }
  }

  getColumnLabel(column: EmployeeListColumnKey): string {
    return this.employeeListColumnLabels[column];
  }

  async onCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません。' },
      });
      input.value = '';
      return;
    }
    this.bulkSaving = true;
    try {
      const scopeEids =
        this.dataSource.filter
          ? new Set(this.dataSource.filteredData.map((r) => r.eid))
          : undefined;
      const result = await this.importService.importFromCsv(tid, file, {
        allRows: this.dataSource.data,
        scopeEids,
      });
      await this.loadEmployees(tid);
      const uid = this.currentTenantService.currentTid() ? this.authService.uid() : null;
      if (uid) {
        await this.currentTenantService.reloadCurrentEmployeeId(uid);
      }
      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: 'CSVインポート結果',
          message:
            `更新: ${result.updated}件 / ` +
            `未一致: ${result.skippedNoMatch}件 / ` +
            `範囲外: ${result.skippedOutOfScope}件 / ` +
            `氏名重複: ${result.skippedAmbiguous}件 / ` +
            `空欄のみ: ${result.skippedEmpty}件`,
        },
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.bulkSaving = false;
      input.value = '';
    }
  }

  formatValue(value: string): string {
    switch (value) {
      case '':
        return '-未設定-';
      case 'admin':
        return '管理者';
      case 'member':
        return '一般';
      case 'full-time':
        return '正社員';
      case 'short-time-worker':
        return '短時間就労者';
      case 'short-time-labor':
        return '短時間労働者';
      case 'active':
        return '在職';
      case 'leave':
        return '休職';
      case 'resigned':
        return '退職';
      case 'monthly':
        return '月給';
      case 'weekly':
        return '週給';
      case 'daily':
        return '日給';
      case 'hourly':
        return '時給';
      default:
        return value;
    }
  }
}

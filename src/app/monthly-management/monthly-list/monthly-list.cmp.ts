import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { MonthlyManagementDataService } from '../monthly-management-data.service';
import { MonthlyListColumnKey, MonthlyListRow, MONTHLY_LIST_COLUMN_LABELS } from './monthly-list-columns';
import { MonthlyDocument } from '../../monthly-document';
import { BulkColumnEditDialogCmp, BulkColumnEditDialogData } from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue } from './monthly-bulk-edit.types';
import { MonthlyListBulkEditService } from './monthly-list-bulk-edit.service';
import {
  formatMonthlyListCellValue,
  monthlyListSearchText,
  monthlyListSortValue,
  toMonthlyListRow,
} from './monthly-list-row.mapper';
import { isBonusDetailColumn } from './bonus-display.util';
import { BonusDetailDialogCmp, BonusDetailDialogData } from './bonus-detail-dialog/bonus-detail-dialog.cmp';

@Component({
  selector: 'app-monthly-list',
  imports: [
    MatTableModule,
    MatSortModule,
    FormsModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatTooltipModule,
  ],
  templateUrl: './monthly-list.cmp.html',
  styleUrl: './monthly-list.cmp.css',
})
export class MonthlyListCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dataService = inject(MonthlyManagementDataService);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(MonthlyListBulkEditService);

  readonly monthlyListColumnLabels = MONTHLY_LIST_COLUMN_LABELS;
  readonly visibleColumns = computed(() => this.dataService.visibleColumns());
  readonly tableColumns = computed(() => ['selected', ...this.visibleColumns()]);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<MonthlyListRow>([]);
  loading = true;
  bulkSaving = false;

  searchTargetColumn: MonthlyListColumnKey = 'displayName';
  searchQuery = '';

  selectedEids = new Set<string>();

  readonly selectedMonth = signal(this.startOfMonth(new Date()));

  readonly yyyyMm = computed(() => {
    const d = this.selectedMonth();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) =>
      monthlyListSortValue(row, property as MonthlyListColumnKey);

    effect(async () => {
      const tid = this.currentTenantService.currentTid();
      const ym = this.yyyyMm();
      if (!tid || !ym) {
        this.dataSource.data = [];
        this.selectedEids.clear();
        this.loading = false;
        return;
      }
      await Promise.all([
        this.loadMonthlyRecords(tid, ym),
        this.dataService.loadListSettings(tid),
      ]);
    });

    this.dataSource.filterPredicate = (data: MonthlyListRow, filter: string) => {
      const searchCondition = JSON.parse(filter) as {
        column: MonthlyListColumnKey;
        query: string;
      };

      const text = monthlyListSearchText(data, searchCondition.column).toLowerCase();
      return text.includes(searchCondition.query);
    };
  }

  onMonthSelected(normalizedMonth: Date, datepicker: MatDatepicker<Date>): void {
    this.selectedMonth.set(this.startOfMonth(normalizedMonth));
    datepicker.close();
  }

  onSelectedMonthChange(value: Date | null): void {
    if (!value) return;
    this.selectedMonth.set(this.startOfMonth(value));
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private async loadMonthlyRecords(tid: string, yyyyMm: string): Promise<void> {
    this.loading = true;
    const monthlyRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      yyyyMm,
      'employees',
    );
    const monthly = await getDocs(monthlyRef);
    const data = monthly.docs.map((snap) =>
      toMonthlyListRow(snap.id, snap.data() as Partial<MonthlyDocument>),
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

  onCellClick(row: MonthlyListRow, col: MonthlyListColumnKey): void {
    if (col === 'displayName') {
      this.routesService.redirectToEmployeeEmployDetail(row.eid);
      return;
    }

    if (isBonusDetailColumn(col)) {
      this.openBonusDetailDialog(row);
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    this.openBulkEditDialog(col as BulkEditableColumn, row[col as keyof MonthlyListRow], targetEids);
  }

  formatCellValue(row: MonthlyListRow, col: MonthlyListColumnKey): string {
    return formatMonthlyListCellValue(row, col);
  }

  bonusTooltip(row: MonthlyListRow): string {
    return row.bonusTooltip;
  }

  isBonusSummaryColumn(col: MonthlyListColumnKey): boolean {
    return col === 'bonus';
  }

  private resolveTargetEids(eid: string): string[] {
    if (this.selectedEids.size === 0) {
      return [eid];
    }

    return this.selectedEids.has(eid) ? [...this.selectedEids] : [eid];
  }

  private openBonusDetailDialog(row: MonthlyListRow): void {
    this.dialog.open<BonusDetailDialogCmp, BonusDetailDialogData>(BonusDetailDialogCmp, {
      width: '420px',
      data: {
        displayName: row.displayName,
        yyyyMm: this.yyyyMm(),
        bonus: row.bonus,
      },
    });
  }

  private openBulkEditDialog(
    column: BulkEditableColumn,
    initialValue: unknown,
    targetEids: string[],
  ): void {
    const dialogRef = this.dialog.open<
      BulkColumnEditDialogCmp,
      BulkColumnEditDialogData,
      BulkEditValue | undefined
    >(BulkColumnEditDialogCmp, {
      width: '420px',
      data: {
        column,
        label: this.monthlyListColumnLabels[column],
        selectedCount: targetEids.length,
        initialValue,
      },
    });

    dialogRef.afterClosed().subscribe(async (value: BulkEditValue | undefined) => {
      if (value === undefined) return;
      await this.applyBulkEdit(column, value, targetEids);
    });
  }

  private async applyBulkEdit(
    column: BulkEditableColumn,
    value: BulkEditValue,
    targetEids: string[],
  ): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || targetEids.length === 0) return;
    this.bulkSaving = true;
    try {
      await this.bulkEditService.applyBulkEdit(tid, ym, targetEids, column, value);
      await this.loadMonthlyRecords(tid, ym);
    } finally {
      this.bulkSaving = false;
    }
  }

  getColumnLabel(column: MonthlyListColumnKey): string {
    return this.monthlyListColumnLabels[column];
  }
}

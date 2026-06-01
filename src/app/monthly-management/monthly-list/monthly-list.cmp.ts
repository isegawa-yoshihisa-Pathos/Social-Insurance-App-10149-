import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { MonthlyManagementDataService } from '../monthly-management-data.service';
import { MonthlyListColumnKey, MonthlyListRow, getMonthlyListColumnLabel } from './monthly-list-columns';
import { MonthlyDocument } from '../../monthly-document';
import { BulkColumnEditDialogCmp, BulkColumnEditDialogData } from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue, isEditableColumn } from './monthly-bulk-edit.types';
import { MonthlyListBulkEditService } from './monthly-list-bulk-edit.service';
import {
  formatMonthlyListCellValue,
  getMonthlyListEditValue,
  monthlyListSearchText,
  monthlyListSortValue,
  toMonthlyListRow,
} from './monthly-list-row.mapper';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { MonthlySettingDataService } from '../monthly-setting/monthly-setting-data.service';
import { MonthlyListImportService } from './monthly-list-import.service';
import { MonthlyListDataService } from './monthly-list-data.service';
import { HelpContentCmp } from '../../help-content/help-content.cmp';

@Component({
  selector: 'app-monthly-list',
  imports: [
    MatTableModule,
    MatSortModule,
    FormsModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatIconModule,
    MatButtonModule,
    HelpContentCmp,
  ],
  templateUrl: './monthly-list.cmp.html',
  styleUrl: './monthly-list.cmp.css',
})
export class MonthlyListCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly monthlyManagementDataService = inject(MonthlyManagementDataService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(MonthlyListBulkEditService);
  private readonly importService = inject(MonthlyListImportService);
  private readonly listDataService = inject(MonthlyListDataService);

  readonly visibleColumns = computed(() => this.monthlySettingDataService.visibleColumns());
  readonly tableColumns = computed(() => ['selected', ...this.visibleColumns()]);

  readonly yearOptions = YEAR_OPTIONS;
  readonly monthOptions = MONTH_OPTIONS;

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<MonthlyListRow>([]);
  loading = true;
  bulkSaving = false;
  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  searchTargetColumn: MonthlyListColumnKey = 'employeeId';
  searchQuery = '';

  readonly hasMonthlyRecords = computed(() => this.dataSource.data.length > 0);
  readonly isFilterActive = computed(() => !!this.searchQuery.trim());
  readonly hasFilteredResults = computed(() => this.dataSource.filteredData.length > 0);
  readonly monthlyRecordExists = signal<boolean>(false);
  initializing = false;

  selectedEids = new Set<string>();

  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  readonly yyyyMm = computed(() => {
    const y = this.selectedYear();
    const m = String(this.selectedMonth()).padStart(2, '0');
    return `${y}-${m}`;
  });

  previousMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedYear.set(this.selectedYear() - 1);
      this.selectedMonth.set(12);
    } else {
      this.selectedMonth.set(this.selectedMonth() - 1);
    }
  }

  nextMonth(): void {
    if (this.selectedMonth() === 12) {
      this.selectedYear.set(this.selectedYear() + 1);
      this.selectedMonth.set(1);
    } else {
      this.selectedMonth.set(this.selectedMonth() + 1);
    }
  }

  setThisMonth(): void {
    this.selectedYear.set(new Date().getFullYear());
    this.selectedMonth.set(new Date().getMonth() + 1);
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) =>
      monthlyListSortValue(row, property as MonthlyListColumnKey);

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const ym = this.yyyyMm();
      if (!tid || !ym) {
        this.dataSource.data = [];
        this.selectedEids.clear();
        this.settingsLoadedTid = null;
        this.loading = false;
        return;
      }

      const token = ++this.loadToken;
      void this.loadForPeriod(tid, ym, token);
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

  private async loadForPeriod(tid: string, ym: string, token: number): Promise<void> {
    this.loading = true;
    this.searchQuery = '';
    this.dataSource.filter = '';
    try {
      if (this.settingsLoadedTid !== tid) {
        await this.monthlySettingDataService.loadListSettings(tid);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }
      await this.loadMonthlyRecords(tid, ym, token);
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
      }
    }
  }

  private async loadMonthlyRecords(
    tid: string,
    yyyyMm: string,
    token?: number,
  ): Promise<void> {
    const monthlyRef = collection(
      this.firestore,
      'tenants',
      tid,
      'monthly-records',
      yyyyMm,
      'employees',
    );
    const [monthly, employeeLookup] = await Promise.all([
      getDocs(monthlyRef),
      this.listDataService.loadEmployeeLookup(tid),
    ]);
    if (token !== undefined && token !== this.loadToken) return;

    const data = monthly.docs.map((snap) => {
      const row = toMonthlyListRow(
        snap.id,
        snap.data() as Partial<MonthlyDocument>,
        this.monthlyManagementDataService.bonusTypeDefinitions(),
      );
      return this.listDataService.mergeEmployeeMeta(row, employeeLookup);
    });
    this.monthlyRecordExists.set(data.length > 0);
    this.dataSource.data = data;
    const alive = new Set(data.map((r) => r.eid));
    this.selectedEids = new Set([...this.selectedEids].filter((eid) => alive.has(eid)));
  }

  async initializeMonthlyRecords(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || this.monthlyRecordExists()) return;
    this.initializing = true;
    try {
      const created = await this.listDataService.initializeMonthlyRecords(tid, ym);
      await this.loadMonthlyRecords(tid, ym);
      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: '月次データ作成',
          message: `${created}件の月次レコードを作成しました。`,
        },
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.initializing = false;
    }
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
    if (col === 'displayName' || col === 'employeeId') {
      this.routesService.redirectToEmployeeEmployDetail(row.eid);
      return;
    }
    if (col === 'bonus' || !isEditableColumn(col)) {
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    this.openBulkEditDialog(col, getMonthlyListEditValue(row, col), targetEids);
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

  private openBulkEditDialog(
    column: BulkEditableColumn,
    initialValue: BulkEditValue,
    targetEids: string[],
  ): void {
    const targetRow = targetEids.length === 1
      ? this.dataSource.data.find((r) => r.eid === targetEids[0])
      : undefined;

    const dialogRef = this.dialog.open<
      BulkColumnEditDialogCmp,
      BulkColumnEditDialogData,
      BulkEditValue | undefined
    >(BulkColumnEditDialogCmp, {
      width: '420px',
      data: {
        column,
        displayName: targetRow?.displayName,
        employeeId: targetRow?.employeeId,
        label: getMonthlyListColumnLabel(column, this.monthlyManagementDataService.bonusTypeDefinitions()),
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

    const targets = targetEids.map((eid) => {
      const row = this.dataSource.data.find((r) => r.eid === eid);
      return { eid, bonus: row?.bonus ?? {} };
    });

    try {
      await this.bulkEditService.applyBulkEdit(tid, ym, targets, column, value);
      await this.loadMonthlyRecords(tid, ym);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: {
          title: 'エラー',
          message: 'データの更新に失敗しました。',
        },
      });
    }
  }

  getColumnLabel(column: MonthlyListColumnKey): string {
    return getMonthlyListColumnLabel(column, this.monthlyManagementDataService.bonusTypeDefinitions());
  }

  async onCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所または対象月が選択されていません。' },
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
        yyyyMm: ym,
        allRows: this.dataSource.data,
        scopeEids,
      });

      await this.loadMonthlyRecords(tid, ym);

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
}

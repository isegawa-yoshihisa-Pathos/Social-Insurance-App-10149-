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
import { BonusManagementDataService } from '../bonus-management-data.service';
import { BonusListColumnKey, BonusListRow, getBonusListColumnLabel } from './bonus-list-columns';
import { BonusDocument } from '../../bonus-document';
import { BulkColumnEditDialogCmp, BulkColumnEditDialogData } from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue, isEditableColumn } from './bonus-bulk-edit.types';
import { BonusListBulkEditService } from './bonus-list-bulk-edit.service';
import { formatBonusListCellValue, getBonusListEditValue, bonusListSearchText, bonusListSortValue, toBonusListRow } from './bonus-list-row.mapper';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { BonusSettingDataService } from '../bonus-setting/bonus-setting-data.service';
import { BonusListImportService } from './bonus-list-import.service';
import { BonusListDataService } from './bonus-list-data.service';
import { HelpContentCmp } from '../../help-content/help-content.cmp';
import { BonusPremiumRecalculateFacade } from '../bonus-premium/bonus-premium-recalculate.facade';

@Component({
  selector: 'app-bonus-list',
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
  templateUrl: './bonus-list.cmp.html',
  styleUrl: './bonus-list.cmp.css',
})
export class BonusListCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly premiumRecalculateFacade = inject(BonusPremiumRecalculateFacade);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(BonusListBulkEditService);
  private readonly importService = inject(BonusListImportService);
  private readonly listDataService = inject(BonusListDataService);

  readonly visibleColumns = computed(() => this.bonusSettingDataService.visibleColumns());
  readonly tableColumns = computed(() => ['selected', ...this.visibleColumns()]);

  readonly yearOptions = YEAR_OPTIONS;
  readonly monthOptions = MONTH_OPTIONS;

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<BonusListRow>([]);
  loading = true;
  bulkSaving = false;
  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  searchTargetColumn: BonusListColumnKey = 'employeeId';
  searchQuery = '';

  readonly hasBonusRecords = computed(() => this.dataSource.data.length > 0);
  readonly isFilterActive = computed(() => !!this.searchQuery.trim());
  readonly hasFilteredResults = computed(() => this.dataSource.filteredData.length > 0);
  readonly bonusRecordExists = signal<boolean>(false);
  initializing = false;

  premiumRecalculating = false;

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
      bonusListSortValue(row, property as BonusListColumnKey);

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

    this.dataSource.filterPredicate = (data: BonusListRow, filter: string) => {
      const searchCondition = JSON.parse(filter) as {
        column: BonusListColumnKey;
        query: string;
      };

      const text = bonusListSearchText(data, searchCondition.column).toLowerCase();
      return text.includes(searchCondition.query);
    };
  }

  private async loadForPeriod(tid: string, ym: string, token: number): Promise<void> {
    this.loading = true;
    this.searchQuery = '';
    this.dataSource.filter = '';
    try {
      if (this.settingsLoadedTid !== tid) {
        await this.bonusSettingDataService.loadListSettings(tid);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }
      await this.loadBonusRecords(tid, ym, token);
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
      }
    }
  }

  private async loadBonusRecords(
    tid: string,
    yyyyMm: string,
    token?: number,
  ): Promise<void> {
    const bonusRef = collection(
      this.firestore,
      'tenants',
      tid,
      'bonus-records',
      yyyyMm,
      'employees',
    );
    const [bonus, employeeLookup] = await Promise.all([
      getDocs(bonusRef),
      this.listDataService.loadEmployeeLookup(tid),
    ]);
    if (token !== undefined && token !== this.loadToken) return;

    const data = bonus.docs.map((snap) => {
      const row = toBonusListRow(
        snap.id,
        snap.data() as Partial<BonusDocument>,
        this.bonusManagementDataService.bonusTypeDefinitions(),
      );
      return this.listDataService.mergeEmployeeMeta(row, employeeLookup);
    });
    this.bonusRecordExists.set(data.length > 0);
    this.dataSource.data = data;
    const alive = new Set(data.map((r) => r.eid));
    this.selectedEids = new Set([...this.selectedEids].filter((eid) => alive.has(eid)));
  }

  async initializeBonusRecords(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || this.bonusRecordExists()) return;
    this.initializing = true;
    try {
      const created = await this.listDataService.initializeBonusRecords(tid, ym);
      await this.loadBonusRecords(tid, ym);
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

  onCellClick(row: BonusListRow, col: BonusListColumnKey): void {
    if (col === 'displayName' || col === 'employeeId') {
      this.routesService.redirectToEmployeeEmployDetail(row.eid);
      return;
    }
    if (col === 'bonus' || !isEditableColumn(col)) {
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    this.openBulkEditDialog(col, getBonusListEditValue(row, col), targetEids);
  }

  formatCellValue(row: BonusListRow, col: BonusListColumnKey): string {
    return formatBonusListCellValue(row, col);
  }

  bonusTooltip(row: BonusListRow): string {
    return row.bonusTooltip;
  }

  isBonusSummaryColumn(col: BonusListColumnKey): boolean {
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
        label: getBonusListColumnLabel(column, this.bonusManagementDataService.bonusTypeDefinitions()),
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
      await this.loadBonusRecords(tid, ym);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: {
          title: 'エラー',
          message: 'データの更新に失敗しました。',
        },
      });
    }
  }

  getColumnLabel(column: BonusListColumnKey): string {
    return getBonusListColumnLabel(column, this.bonusManagementDataService.bonusTypeDefinitions());
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

      await this.loadBonusRecords(tid, ym);

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

  async recalculatePremiums(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || !this.bonusRecordExists()) return;
    this.premiumRecalculating = true;
    try {
      await this.premiumRecalculateFacade.recalculateMonth(tid, ym, () =>
        this.loadBonusRecords(tid, ym),
      );
    } finally {
      this.premiumRecalculating = false;
    }
  }
}

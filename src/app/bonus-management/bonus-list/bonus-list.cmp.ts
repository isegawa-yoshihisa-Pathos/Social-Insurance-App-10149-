import { Component, computed, effect, inject, signal, ViewChild, OnInit } from '@angular/core';
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
import { MatMenuModule } from '@angular/material/menu';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { BonusManagementDataService } from '../bonus-management-data.service';
import { BonusListColumnKey, BonusListRow, getBonusListColumnLabel } from './bonus-list-columns';
import { BonusDocument } from '../../bonus-document';
import { BulkColumnEditDialogCmp, BulkColumnEditDialogData } from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue, isEditableColumn } from './bonus-bulk-edit.types';
import { BonusListBulkEditService } from './bonus-list-bulk-edit.service';
import { formatBonusListCellValue, getBonusListEditValue, isSummableBonusListColumn, bonusListNumericValue, bonusListSearchText, bonusListSortValue, toBonusListRow } from './bonus-list-row.mapper';
import { bonusListEmployerBurden, type EmployerBurdenRoundingSettings } from './bonus-list-summary.util';
import { InsuranceRateDataService } from '../../social-insurance/monthly/insurance-rate-data.service';
import { toEmployerBurdenRoundingSettings } from '../../../../shared/social-insurance/premium/employer-burden-settings.util';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { BonusSettingDataService } from '../bonus-setting/bonus-setting-data.service';
import { BonusListImportService } from './bonus-list-import.service';
import { BonusListExportService } from './bonus-list-export.service';
import { BonusListDataService } from './bonus-list-data.service';
import { downloadCsvFile } from '../../csv/csv-file.util';
import { HelpContentCmp } from '../../help-content/help-content.cmp';
import { BonusPremiumCalculateFacade } from '../bonus-premium/bonus-premium-calculate.facade';
import { Router, ActivatedRoute } from '@angular/router';
import { Format } from '../../format-number-jp';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  ListAddEmployeesDialogCmp,
} from '../../list-add-employees-dialog/list-add-employees-dialog.cmp';
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
    MatMenuModule,
  ],
  templateUrl: './bonus-list.cmp.html',
  styleUrl: './bonus-list.cmp.css',
})
export class BonusListCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly premiumCalculateFacade = inject(BonusPremiumCalculateFacade);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(BonusListBulkEditService);
  private readonly importService = inject(BonusListImportService);
  private readonly exportService = inject(BonusListExportService);
  private readonly listDataService = inject(BonusListDataService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly insuranceRateDataService = inject(InsuranceRateDataService);

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

  private readonly tableViewRevision = signal(0);

  readonly hasBonusRecords = computed(() => {
    this.tableViewRevision();
    return this.dataSource.data.length > 0;
  });
  readonly isFilterActive = computed(() => {
    this.tableViewRevision();
    return !!this.searchQuery.trim();
  });
  readonly hasFilteredResults = computed(() => {
    this.tableViewRevision();
    return this.dataSource.filteredData.length > 0;
  });
  readonly bonusRecordExists = signal<boolean>(false);
  readonly employerBurdenRounding = signal<EmployerBurdenRoundingSettings | null>(null);

  readonly tenantEmployerBurden = computed(() => {
    this.tableViewRevision();
    const rounding = this.employerBurdenRounding();
    if (!rounding) {
      return 0;
    }
    return bonusListEmployerBurden(this.dataSource.filteredData, rounding);
  });

  premiumRecalculating = false;

  selectedEids = new Set<string>();

  readonly locked = signal(false);

  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  readonly yyyyMm = computed(() => {
    const y = this.selectedYear();
    const m = String(this.selectedMonth()).padStart(2, '0');
    return `${y}-${m}`;
  });

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private getDisplayedRows(): BonusListRow[] {
    return this.dataSource.filteredData;
  }

  private refreshTableView(): void {
    this.tableViewRevision.update((value) => value + 1);
  }

  formatFooterValue(col: BonusListColumnKey): string {
    if (col === 'displayName') {
      return `合計 (${this.getDisplayedRows().length}件)`;
    }
    if (col === 'employeeId') return '';
    if (!isSummableBonusListColumn(col)) return '';

    const total = this.getDisplayedRows().reduce(
      (sum, row) => sum + (bonusListNumericValue(row, col) ?? 0),
      0,
    );
    return total === 0 ? '' : Format(total);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['yyyyMm']) {
        this.selectedYear.set(parseInt(params['yyyyMm'].split('-')[0]));
        this.selectedMonth.set(parseInt(params['yyyyMm'].split('-')[1]));
      } else {
        this.updateUrlQuery(this.yyyyMm());
      }
    });
  }

  async lockPeriod(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || this.locked() || !this.bonusRecordExists()) return;

    const confirmed = confirm(
      `${ym} の賞与データを締切しますか？\n締切後は賞与データの変更・インポート・保険料の再計算ができなくなります。`,
    );
    if (!confirmed) return;

    try {
      await this.listDataService.lockPeriod(tid, ym);
      this.locked.set(true);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }

  private updateUrlQuery(yyyyMm: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { yyyyMm },
      queryParamsHandling: 'merge',
    });
  }

  previousMonth(): void {
    if (this.selectedMonth() === 1) {
      this.selectedYear.set(this.selectedYear() - 1);
      this.selectedMonth.set(12);
    } else {
      this.selectedMonth.set(this.selectedMonth() - 1);
    }
    this.updateUrlQuery(this.yyyyMm());
  }

  nextMonth(): void {
    if (this.selectedMonth() === 12) {
      this.selectedYear.set(this.selectedYear() + 1);
      this.selectedMonth.set(1);
    } else {
      this.selectedMonth.set(this.selectedMonth() + 1);
    }
    this.updateUrlQuery(this.yyyyMm());
  }

  setThisMonth(): void {
    this.selectedYear.set(new Date().getFullYear());
    this.selectedMonth.set(new Date().getMonth() + 1);
    this.updateUrlQuery(this.yyyyMm());
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) =>
      bonusListSortValue(row, property as BonusListColumnKey);

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const ym = this.yyyyMm();
      if (!tid || !ym) {
        this.dataSource.data = [];
        this.refreshTableView();
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
    this.refreshTableView();
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
    const [bonus, employeeLookup, period, rate] = await Promise.all([
      getDocs(bonusRef),
      this.listDataService.loadEmployeeLookup(tid),
      this.listDataService.getPeriod(tid, yyyyMm),
      this.insuranceRateDataService.resolveRateForMonth(tid, yyyyMm),
    ]);
    if (token !== undefined && token !== this.loadToken) return;

    this.employerBurdenRounding.set(toEmployerBurdenRoundingSettings(rate));

    this.locked.set(period?.locked === true);

    const data = await this.listDataService.enrichWithStandardBonus(
      tid,
      yyyyMm,
      bonus.docs.map((snap) => {
        const row = toBonusListRow(
          snap.id,
          snap.data() as Partial<BonusDocument>,
          this.bonusManagementDataService.bonusTypeDefinitions(),
        );
        return this.listDataService.mergeEmployeeMeta(row, employeeLookup);
      }),
    );
    this.bonusRecordExists.set(data.length > 0);
    if (data.length > 0) {
      await this.listDataService.ensurePeriodDocument(tid, yyyyMm);
    }
    this.dataSource.data = data;
    this.refreshTableView();
    const alive = new Set(data.map((r) => r.eid));
    this.selectedEids = new Set([...this.selectedEids].filter((eid) => alive.has(eid)));
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery.toLowerCase(),
    });
    this.refreshTableView();
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
      this.routesService.redirectToBonusDetail(row.eid);
      return;
    }
    if (this.locked()) return;

    if (!isEditableColumn(col)) {
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    this.openBulkEditDialog(col, getBonusListEditValue(row, col), targetEids);
  }

  formatCellValue(row: BonusListRow, col: BonusListColumnKey): string {
    return formatBonusListCellValue(row, col);
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
      return {
        eid,
        bonus: row?.bonus ?? {},
        healthInsuranceEmployee: row?.healthInsuranceEmployee ?? null,
        healthInsuranceTotal: row?.healthInsuranceTotal ?? null,
        careInsuranceEmployee: row?.careInsuranceEmployee ?? null,
        careInsuranceTotal: row?.careInsuranceTotal ?? null,
        pensionInsuranceEmployee: row?.pensionInsuranceEmployee ?? null,
        pensionInsuranceTotal: row?.pensionInsuranceTotal ?? null,
      };
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

    if (this.locked()) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'この月は締切済みのため、インポートできません。' },
      });
      input.value = '';
      return;
    }

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
      const scopeEids = this.isFilterActive()
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
            `新規作成: ${result.created}件 / ` +
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

  async onMultipleCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const files: File[] = Array.from(input.files);

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
      let updated = 0;
      let created = 0;
      let skippedNoMatch = 0;
      let skippedOutOfScope = 0;
      let skippedAmbiguous = 0;
      let skippedEmpty = 0;
      const currentYm = this.yyyyMm();
      for (const file of files) {
        const ym = file.name.split('.').slice(0, -1).join('.');
        const result = await this.importService.importFromCsv(tid, file, {
          yyyyMm: ym,
        });
        updated += result.updated;
        created += result.created;
        skippedNoMatch += result.skippedNoMatch;
        skippedOutOfScope += result.skippedOutOfScope;
        skippedAmbiguous += result.skippedAmbiguous;
        skippedEmpty += result.skippedEmpty;
      }
      await this.loadBonusRecords(tid, currentYm);

      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: 'CSVインポート結果',
          message:
            `更新: ${updated}件 / ` +
            `新規作成: ${created}件 / ` +
            `未一致: ${skippedNoMatch}件 / ` +
            `範囲外: ${skippedOutOfScope}件 / ` +
            `氏名重複: ${skippedAmbiguous}件 / ` +
            `空欄のみ: ${skippedEmpty}件`,
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

  async exportData(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym) return;

    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    await this.bonusSettingDataService.loadSettings(tid, bonusDefinitions);
    const filtered = this.dataSource.filteredData;
    const sortedAndFilteredData = this.dataSource.sort 
      ? this.dataSource.sortData(filtered, this.dataSource.sort)
      : filtered;
    const csv = this.exportService.buildCsv(
      ym,
      this.visibleColumns(),
      sortedAndFilteredData,
      this.bonusSettingDataService.importHeaders(),
      bonusDefinitions,
    );
    downloadCsvFile(`${ym}.csv`, csv);
  }

  async calculatePremiums(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || !this.bonusRecordExists()) return;
    if (this.locked()) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'この月は締切済みのため、保険料を再計算できません。' },
      });
      return;
    }
    this.premiumRecalculating = true;
    try {
      await this.premiumCalculateFacade.calculateMonth(tid, ym, () =>
        this.loadBonusRecords(tid, ym),
      );
      await this.auditLogService.record({
        tid,
        action: 'create',
        category: 'premium.calculate',
        summary: '賞与保険料を計算',
        target: this.auditLogService.monthlyTarget(ym),
      });
    } finally {
      this.premiumRecalculating = false;
    }
  }

  formatAmount(amount: number): string {
    return amount === 0 ? '0' : Format(amount);
  }

  async openAddEmployeesDialog(): Promise<void> {
    if (this.locked()) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'この月は締切済みのため、追加できません。' },
      });
      return;
    }

    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym) {
      return;
    }

    const lookup = await this.listDataService.loadEmployeeLookup(tid);
    const existingEids = new Set(this.dataSource.data.map((row) => row.eid));
    const employees = [...lookup.values()]
      .filter((employee) => !existingEids.has(employee.eid))
      .map((employee) => ({
        eid: employee.eid,
        employeeId: employee.employeeId,
        displayName: employee.displayName,
      }))
      .sort((a, b) => {
        const nameCmp = a.displayName.localeCompare(b.displayName, 'ja');
        if (nameCmp !== 0) {
          return nameCmp;
        }
        return a.employeeId.localeCompare(b.employeeId, 'ja');
      });

    const dialogRef = this.dialog.open(ListAddEmployeesDialogCmp, {
      width: '480px',
      data: {
        title: '賞与データを追加',
        employees,
      },
    });

    dialogRef.afterClosed().subscribe(async (selectedEids: string[] | undefined) => {
      if (!selectedEids?.length) {
        return;
      }

      this.bulkSaving = true;
      try {
        const created = await this.listDataService.addEmployeesWithEmptyData(
          tid,
          ym,
          selectedEids,
        );
        await this.loadBonusRecords(tid, ym);
        if (created > 0) {
          this.dialog.open(SuccessDialogCmp, {
            data: {
              title: '追加完了',
              message: `${created}件の賞与データを追加しました。`,
            },
          });
        }
      } catch (error) {
        this.dialog.open(ErrorDialogCmp, {
          data: { message: mapFirebaseError(error) },
        });
      } finally {
        this.bulkSaving = false;
      }
    });
  }
}

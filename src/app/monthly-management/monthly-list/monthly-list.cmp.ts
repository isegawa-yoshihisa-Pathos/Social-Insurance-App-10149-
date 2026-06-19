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
import { MonthlyListColumnKey, MonthlyListRow, getMonthlyListColumnLabel } from './monthly-list-columns';
import { MonthlyDocument } from '../../monthly-document';
import { BulkColumnEditDialogCmp, BulkColumnEditDialogData } from './bulk-column-edit-dialog/bulk-column-edit-dialog.cmp';
import { BulkEditableColumn, BulkEditValue, isEditableColumn } from './monthly-bulk-edit.types';
import { MonthlyListBulkEditService } from './monthly-list-bulk-edit.service';
import { formatMonthlyListCellValue, getMonthlyListEditValue, isSummableMonthlyListColumn, monthlyListNumericValue, monthlyListSearchText, monthlyListSortValue, toMonthlyListRow } from './monthly-list-row.mapper';
import { monthlyListEmployerBurden, type EmployerBurdenRoundingSettings } from './monthly-list-summary.util';
import { InsuranceRateDataService } from '../../social-insurance/monthly/insurance-rate-data.service';
import { toEmployerBurdenRoundingSettings } from '../../../../shared/social-insurance/premium/employer-burden-settings.util';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { MonthlySettingDataService } from '../monthly-setting/monthly-setting-data.service';
import { MonthlyListImportService } from './monthly-list-import.service';
import { MonthlyListExportService } from './monthly-list-export.service';
import { MonthlyListDataService } from './monthly-list-data.service';
import { downloadCsvFile } from '../../csv/csv-file.util';
import { HelpContentCmp } from '../../help-content/help-content.cmp';
import { MonthlyPremiumCalculateFacade } from '../monthly-premium/monthly-premium-calculate.facade';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Format } from '../../format-number-jp';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  ListAddEmployeesDialogCmp,
} from '../../list-add-employees-dialog/list-add-employees-dialog.cmp';

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
    MatMenuModule,
  ],
  templateUrl: './monthly-list.cmp.html',
  styleUrl: './monthly-list.cmp.css',
})
export class MonthlyListCmp implements OnInit {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly premiumCalculateFacade = inject(MonthlyPremiumCalculateFacade);
  private readonly dialog = inject(MatDialog);
  private readonly bulkEditService = inject(MonthlyListBulkEditService);
  private readonly importService = inject(MonthlyListImportService);
  private readonly exportService = inject(MonthlyListExportService);
  private readonly listDataService = inject(MonthlyListDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly auditLogService = inject(AuditLogService);
  private readonly insuranceRateDataService = inject(InsuranceRateDataService);

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

  private readonly tableViewRevision = signal(0);

  readonly isFilterActive = computed(() => {
    this.tableViewRevision();
    return !!this.searchQuery.trim();
  });
  readonly hasFilteredResults = computed(() => {
    this.tableViewRevision();
    return this.dataSource.filteredData.length > 0;
  });
  readonly monthlyRecordExists = signal<boolean>(false);
  readonly employerBurdenRounding = signal<EmployerBurdenRoundingSettings | null>(null);

  readonly tenantEmployerBurden = computed(() => {
    this.tableViewRevision();
    const rounding = this.employerBurdenRounding();
    if (!rounding) {
      return 0;
    }
    return monthlyListEmployerBurden(this.dataSource.filteredData, rounding);
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

  private getDisplayedRows(): MonthlyListRow[] {
    return this.dataSource.filteredData;
  }

  private refreshTableView(): void {
    this.tableViewRevision.update((value) => value + 1);
  }

  formatFooterValue(col: MonthlyListColumnKey): string {
    if (col === 'displayName') {
      return `合計 (${this.getDisplayedRows().length}件)`;
    }
    if (col === 'employeeId') return '';
    if (col === 'paymentBaseDays') return '';
    if (!isSummableMonthlyListColumn(col)) return '';
    const total = this.getDisplayedRows().reduce(
      (sum, row) => sum + (monthlyListNumericValue(row, col) ?? 0),
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
    if (!tid || !ym || this.locked() || !this.monthlyRecordExists()) return;

    const confirmed = confirm(
      `${ym} の月次データを締切しますか？\n締切後は給与データの変更・インポート・保険料の再計算ができなくなります。`,
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
      monthlyListSortValue(row, property as MonthlyListColumnKey);

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
    this.refreshTableView();
    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.paymentManagementDataService.loadPaymentSettings(tid),
          this.monthlySettingDataService.loadListSettings(tid),
        ]);
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
    const [monthly, employeeLookup, period, rate] = await Promise.all([
      getDocs(monthlyRef),
      this.listDataService.loadEmployeeLookup(tid),
      this.listDataService.getPeriod(tid, yyyyMm),
      this.insuranceRateDataService.resolveRateForMonth(tid, yyyyMm),
    ]);
    if (token !== undefined && token !== this.loadToken) return;

    this.employerBurdenRounding.set(toEmployerBurdenRoundingSettings(rate));

    this.locked.set(period?.locked === true);

    const data = await this.listDataService.enrichWithStandardRemuneration(
      tid,
      yyyyMm,
      monthly.docs.map((snap) => {
        const row = toMonthlyListRow(
          snap.id,
          snap.data() as Partial<MonthlyDocument>,
        );
        return this.listDataService.mergeEmployeeMeta(row, employeeLookup);
      }),
    );
    this.monthlyRecordExists.set(data.length > 0);
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

  onCellClick(row: MonthlyListRow, col: MonthlyListColumnKey): void {
    if (col === 'displayName' || col === 'employeeId') {
      this.routesService.redirectToMonthlyDetail(row.eid);
      return;
    }

    if (this.locked()) return;

    if (!isEditableColumn(col)) {
      return;
    }

    const targetEids = this.resolveTargetEids(row.eid);
    this.openBulkEditDialog(col, getMonthlyListEditValue(row, col), targetEids);
  }

  formatCellValue(row: MonthlyListRow, col: MonthlyListColumnKey): string {
    return formatMonthlyListCellValue(
      row,
      col,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
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
        label: getMonthlyListColumnLabel(
          column,
          this.paymentManagementDataService.allowanceTypeDefinitions(),
        ),
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
        paymentBaseDays: row?.paymentBaseDays ?? 0,
        basicSalary: row?.basicSalary ?? 0,
        fringeBenefits: row?.fringeBenefits ?? 0,
        allowances: row?.allowances ?? {},
        retroactivePay: row?.retroactivePay ?? null,
        bonusRelatedRemuneration: row?.bonusRelatedRemuneration ?? 0,
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
      await this.loadMonthlyRecords(tid, ym);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'データの更新に失敗しました。';
      this.dialog.open(ErrorDialogCmp, {
        data: {
          title: 'エラー',
          message,
        },
      });
    }
  }

  getColumnLabel(column: MonthlyListColumnKey): string {
    return getMonthlyListColumnLabel(
      column,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
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
      const result = await this.importService.importFromCsv(tid, file, {
        yyyyMm: ym,
      });

      await this.loadMonthlyRecords(tid, ym);

      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: 'CSVインポート結果',
          message:
            `更新: ${result.updated}件 / ` +
            `新規作成: ${result.created}件 / ` +
            `未一致: ${result.skippedNoMatch}件 / ` +
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
      let skippedAmbiguous = 0;
      let skippedEmpty = 0;
      for (const file of files) {
        const ym = file.name.split('.').slice(0, -1).join('.');
        const result = await this.importService.importFromCsv(tid, file, {
          yyyyMm: ym,
        });
        updated += result.updated;
        created += result.created;
        skippedNoMatch += result.skippedNoMatch;
        skippedAmbiguous += result.skippedAmbiguous;
        skippedEmpty += result.skippedEmpty;
        await this.loadMonthlyRecords(tid, ym);
      }

      this.dialog.open(SuccessDialogCmp, {
        data: {
          title: 'CSVインポート結果',
          message:
            `更新: ${updated}件 / ` +
            `新規作成: ${created}件 / ` +
            `未一致: ${skippedNoMatch}件 / ` +
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

    await this.monthlySettingDataService.loadSettings(tid);
    const filtered = this.dataSource.filteredData;
    const sortedAndFilteredData = this.dataSource.sort 
      ? this.dataSource.sortData(filtered, this.dataSource.sort)
      : filtered;

    const csv = this.exportService.buildCsv(
      ym,
      this.visibleColumns(),
      sortedAndFilteredData,
      this.monthlySettingDataService.importHeaders(),
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
    downloadCsvFile(`${ym}.csv`, csv);
  }

  async calculatePremiums(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || !this.monthlyRecordExists()) return;
    if (this.locked()) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: 'この月は締切済みのため、保険料を再計算できません。' },
      });
      return;
    }
    this.premiumRecalculating = true;
    try {
      await this.premiumCalculateFacade.calculateMonth(tid, ym, () =>
        this.loadMonthlyRecords(tid, ym),
      );
      await this.auditLogService.record({
        tid,
        action: 'create',
        category: 'premium.calculate',
        summary: '月次保険料を計算',
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
        title: '月次データを追加',
        employees,
      },
    });

    dialogRef.afterClosed().subscribe(async (selectedEids: string[] | undefined) => {
      if (!selectedEids?.length) {
        return;
      }

      this.bulkSaving = true;
      try {
        const created = await this.listDataService.addEmployeesFromPreviousMonth(
          tid,
          ym,
          selectedEids,
        );
        await this.loadMonthlyRecords(tid, ym);
        if (created > 0) {
          this.dialog.open(SuccessDialogCmp, {
            data: {
              title: '追加完了',
              message: `${created}件の月次データを追加しました。`,
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

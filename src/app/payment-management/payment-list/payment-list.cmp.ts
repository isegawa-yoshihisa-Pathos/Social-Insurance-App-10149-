import { Component, computed, effect, inject, signal, ViewChild, OnInit  } from '@angular/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { PaymentListColumnKey, PaymentListRow, getPaymentListColumnLabel } from './payment-list-columns';
import { formatPaymentListCellValue, isSummablePaymentListColumn, paymentListNumericValue, paymentListSearchText, paymentListSortValue } from './payment-list-row.mapper';
import {
  paymentListBonusEmployerBurden,
  paymentListMonthlyEmployerBurden,
  paymentListTotalEmployerBurden,
  type EmployerBurdenRoundingSettings,
} from './payment-list-summary.util';
import { InsuranceRateDataService } from '../../social-insurance/monthly/insurance-rate-data.service';
import { toEmployerBurdenRoundingSettings } from '../../../../shared/social-insurance/premium/employer-burden-settings.util';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { PaymentSettingDataService } from '../payment-setting/payment-setting-data.service';
import { PaymentListDataService } from './payment-list-data.service';
import { PaymentListExportService } from './payment-list-export.service';
import { PaymentManagementDataService } from '../payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { MonthlySettingDataService } from '../../monthly-management/monthly-setting/monthly-setting-data.service';
import { BonusSettingDataService } from '../../bonus-management/bonus-setting/bonus-setting-data.service';
import { TenantSettingDataService } from '../../tenant-setting/tenant-setting-data.service';
import { downloadCsvFile } from '../../csv/csv-file.util';
import { Router, ActivatedRoute } from '@angular/router';
import { Format } from '../../format-number-jp';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FunctionsService } from '../../functions.service';
import { MainPagePaymentDataService } from '../../main-page/main-page-payment-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../success-dialog/success-dialog.cmp';
import { formatPaymentStatementDisplayMonthLabel } from '../../../../shared/social-insurance/payment/payment-statement-delivery-messages';

@Component({
  selector: 'app-payment-list',
  imports: [
    MatTableModule,
    MatSortModule,
    FormsModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './payment-list.cmp.html',
  styleUrl: './payment-list.cmp.css',
})
export class PaymentListCmp implements OnInit {
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly paymentSettingDataService = inject(PaymentSettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly listDataService = inject(PaymentListDataService);
  private readonly exportService = inject(PaymentListExportService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly tenantSettingDataService = inject(TenantSettingDataService);
  private readonly insuranceRateDataService = inject(InsuranceRateDataService);
  private readonly functionsService = inject(FunctionsService);
  private readonly mainPagePaymentDataService = inject(MainPagePaymentDataService);
  private readonly dialog = inject(MatDialog);

  readonly visibleColumns = computed(() => this.paymentSettingDataService.visibleColumns());
  readonly tableColumns = computed(() => this.visibleColumns());

  readonly yearOptions = YEAR_OPTIONS;
  readonly monthOptions = MONTH_OPTIONS;

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<PaymentListRow>([]);
  loading = true;
  delivering = false;
  deliveryStatus: { deliveredCount: number; lastDeliveredAt: Date | null } | null = null;
  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  searchTargetColumn: PaymentListColumnKey = 'employeeId';
  searchQuery = '';

  private readonly tableViewRevision = signal(0);

  readonly hasRecords = computed(() => {
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

  readonly employerBurdenRounding = signal<EmployerBurdenRoundingSettings | null>(null);

  readonly tenantEmployerSummary = computed(() => {
    this.tableViewRevision();
    const rows = this.dataSource.filteredData;
    const rounding = this.employerBurdenRounding();
    if (!rounding) {
      return { monthly: 0, bonus: 0, total: 0 };
    }
    return {
      monthly: paymentListMonthlyEmployerBurden(rows, rounding),
      bonus: paymentListBonusEmployerBurden(rows, rounding),
      total: paymentListTotalEmployerBurden(rows, rounding),
    };
  });

  readonly selectedYear = signal(new Date().getFullYear());
  readonly selectedMonth = signal(new Date().getMonth() + 1);

  readonly yyyyMm = computed(() => {
    const y = this.selectedYear();
    const m = String(this.selectedMonth()).padStart(2, '0');
    return `${y}-${m}`;
  });

  
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private getDisplayedRows(): PaymentListRow[] {
    return this.dataSource.filteredData;
  }

  private refreshTableView(): void {
    this.tableViewRevision.update((value) => value + 1);
  }

  formatFooterValue(col: PaymentListColumnKey): string {
    if (col === 'displayName') {
      return `合計 (${this.getDisplayedRows().length}件)`;
    }
    if (col === 'employeeId') return '';
    if (col === 'paymentBaseDays') return '';
    if (!isSummablePaymentListColumn(col)) return '';

    const total = this.getDisplayedRows().reduce(
      (sum, row) => sum + (paymentListNumericValue(row, col, this.paymentManagementDataService.allowanceTypeDefinitions(), this.bonusManagementDataService.bonusTypeDefinitions()) ?? 0),
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
      paymentListSortValue(
        row,
        property as PaymentListColumnKey,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
        this.bonusManagementDataService.bonusTypeDefinitions(),
      );

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const ym = this.yyyyMm();
      if (!tid || !ym) {
        this.dataSource.data = [];
        this.refreshTableView();
        this.settingsLoadedTid = null;
        this.loading = false;
        return;
      }

      const token = ++this.loadToken;
      void this.loadForPeriod(tid, ym, token);
    });

    this.dataSource.filterPredicate = (data: PaymentListRow, filter: string) => {
      const searchCondition = JSON.parse(filter) as {
        column: PaymentListColumnKey;
        query: string;
      };

      const text = paymentListSearchText(
        data,
        searchCondition.column,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
        this.bonusManagementDataService.bonusTypeDefinitions(),
      ).toLowerCase();
      return text.includes(searchCondition.query);
    };
  }

  private async loadForPeriod(tid: string, ym: string, token: number): Promise<void> {
    this.loading = true;
    this.deliveryStatus = null;
    this.searchQuery = '';
    this.dataSource.filter = '';
    this.refreshTableView();
    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.paymentManagementDataService.loadPaymentSettings(tid),
          this.bonusManagementDataService.loadBonusSettings(tid),
          this.tenantSettingDataService.loadAll(),
        ]);
        await this.paymentSettingDataService.loadListSettings(tid);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }
      const [data, rate, deliveryStatus] = await Promise.all([
        this.listDataService.loadAggregatedRows(tid, ym),
        this.insuranceRateDataService.resolveRateForMonth(tid, ym),
        this.mainPagePaymentDataService.loadDeliveryStatus(tid, ym),
      ]);
      if (token !== this.loadToken) return;
      this.employerBurdenRounding.set(toEmployerBurdenRoundingSettings(rate));
      this.deliveryStatus = deliveryStatus;
      this.dataSource.data = data;
      this.refreshTableView();
    } finally {
      if (token === this.loadToken) {
        this.loading = false;
      }
    }
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery.toLowerCase(),
    });
    this.refreshTableView();
  }

  onCellClick(row: PaymentListRow, col: PaymentListColumnKey): void {
    this.routesService.redirectToPaymentDetail(row.eid);
  }

  formatCellValue(row: PaymentListRow, col: PaymentListColumnKey): string {
    return formatPaymentListCellValue(
      row,
      col,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  async exportData(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || !this.hasRecords()) return;

    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    await Promise.all([
      this.monthlySettingDataService.loadSettings(tid),
      this.bonusSettingDataService.loadSettings(tid, bonusDefinitions),
    ]);
    const filtered = this.dataSource.filteredData;
    const sortedAndFilteredData = this.dataSource.sort 
      ? this.dataSource.sortData(filtered, this.dataSource.sort)
      : filtered;

    const csv = this.exportService.buildCsv(
      ym,
      this.visibleColumns(),
      sortedAndFilteredData,
      this.monthlySettingDataService.importHeaders(),
      this.bonusSettingDataService.importHeaders(),
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      bonusDefinitions,
    );
    downloadCsvFile(`${ym}.csv`, csv);
  }

  getColumnLabel(column: PaymentListColumnKey): string {
    return getPaymentListColumnLabel(
      column,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  formatAmount(amount: number): string {
    return amount === 0 ? '0' : Format(amount);
  }

  deliveryStatusLabel(): string {
    if (!this.deliveryStatus) {
      return '未送付';
    }
    const label = formatPaymentStatementDisplayMonthLabel(this.yyyyMm());
    const date = this.deliveryStatus.lastDeliveredAt;
    const dateText = date
      ? `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
      : '';
    return `${label}分を ${this.deliveryStatus.deliveredCount} 名に送付済み${dateText ? `（${dateText}）` : ''}`;
  }

  async deliverToEmployees(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const ym = this.yyyyMm();
    if (!tid || !ym || !this.hasRecords() || this.delivering) {
      return;
    }

    this.delivering = true;
    try {
      const result = await this.functionsService.deliverPaymentStatements({
        tid,
        displayYyyyMm: ym,
      });
      this.deliveryStatus = {
        deliveredCount: result.delivered,
        lastDeliveredAt: new Date(),
      };
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            `${formatPaymentStatementDisplayMonthLabel(ym)}分の給与明細を ${result.delivered} 名の従業員へ送付しました。` +
            (result.skippedNoAccount > 0
              ? `\n（アカウント未連携 ${result.skippedNoAccount} 名はマイページ通知を省略しました）`
              : ''),
        },
      });
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.delivering = false;
    }
  }
}

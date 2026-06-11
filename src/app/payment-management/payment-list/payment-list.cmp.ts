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
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../datePicker';
import { PaymentSettingDataService } from '../payment-setting/payment-setting-data.service';
import { PaymentListDataService } from './payment-list-data.service';
import { PaymentManagementDataService } from '../payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Format } from '../../format-number-jp';

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
  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  searchTargetColumn: PaymentListColumnKey = 'employeeId';
  searchQuery = '';

  readonly hasRecords = computed(() => this.dataSource.data.length > 0);
  readonly isFilterActive = computed(() => !!this.searchQuery.trim());
  readonly hasFilteredResults = computed(() => this.dataSource.filteredData.length > 0);

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
    this.searchQuery = '';
    this.dataSource.filter = '';
    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.paymentManagementDataService.loadPaymentSettings(tid),
          this.bonusManagementDataService.loadBonusSettings(tid),
        ]);
        await this.paymentSettingDataService.loadListSettings(tid);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }
      const data = await this.listDataService.loadAggregatedRows(
        tid,
        ym,
        this.bonusManagementDataService.bonusTypeDefinitions(),
      );
      if (token !== this.loadToken) return;
      this.dataSource.data = data;
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
  }

  onCellClick(row: PaymentListRow, col: PaymentListColumnKey): void {
    if (col === 'displayName' || col === 'employeeId') {
      this.routesService.redirectToEmployeeEmployDetail(row.eid);
    }
  }

  formatCellValue(row: PaymentListRow, col: PaymentListColumnKey): string {
    return formatPaymentListCellValue(
      row,
      col,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  getColumnLabel(column: PaymentListColumnKey): string {
    return getPaymentListColumnLabel(
      column,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }
}

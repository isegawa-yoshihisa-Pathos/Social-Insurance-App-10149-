import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { map } from 'rxjs';
import { CurrentTenantService } from '../../../../current-tenant.service';
import { MonthlySettingDataService } from '../../../monthly-setting/monthly-setting-data.service';
import { PaymentManagementDataService } from '../../../../payment-management/payment-management-data.service';
import { MonthlyDetailRow, MonthlyListDataService } from '../../monthly-list-data.service';
import { MonthlyListColumnKey, getMonthlyListColumnLabel } from '../../monthly-list-columns';
import {
  formatMonthlyListCellValue,
  monthlyDetailSearchText,
  monthlyListSortValue,
  type MonthlyDetailColumnKey,
} from '../../monthly-list-row.mapper';
import { MonthlyListExportService } from '../../monthly-list-export.service';
import { downloadCsvFile } from '../../../../csv/csv-file.util';
import { ErrorDialogCmp, mapFirebaseError } from '../../../../error-dialog/error-dialog.cmp';

@Component({
  selector: 'app-monthly-detail-list',
  imports: [
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './monthly-detail-list.cmp.html',
  styleUrl: './monthly-detail-list.cmp.css',
})
export class MonthlyDetailListCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly listDataService = inject(MonthlyListDataService);
  private readonly exportService = inject(MonthlyListExportService);
  private readonly dialog = inject(MatDialog);

  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  readonly eid = toSignal(
    this.route.parent?.paramMap.pipe(map((params) => params.get('eid'))) ??
      this.route.paramMap.pipe(map((params) => params.get('eid'))),
    { initialValue: null },
  );

  readonly loading = signal(true);

  dataSource = new MatTableDataSource<MonthlyDetailRow>([]);

  searchTargetColumn: MonthlyDetailColumnKey = 'yyyyMm';
  searchQuery = '';

  readonly isFilterActive = computed(() => !!this.searchQuery.trim());
  readonly hasFilteredResults = computed(() => this.dataSource.filteredData.length > 0);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  readonly visibleColumns = computed((): MonthlyDetailColumnKey[] => {
    const baseColumns = this.monthlySettingDataService.visibleColumns();
    const filtered = baseColumns.filter(
      (col) => col !== 'displayName' && col !== 'employeeId',
    );
    return ['yyyyMm', ...filtered];
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) => {
      if (property === 'yyyyMm') return row.yyyyMm;
      return monthlyListSortValue(row, property as MonthlyListColumnKey);
    };

    this.dataSource.filterPredicate = (data, filter) => {
      const searchCondition = JSON.parse(filter) as {
        column: MonthlyDetailColumnKey;
        query: string;
      };
      const text = monthlyDetailSearchText(data, searchCondition.column).toLowerCase();
      return text.includes(searchCondition.query);
    };

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.dataSource.data = [];
        this.settingsLoadedTid = null;
        this.loading.set(false);
        return;
      }

      const token = ++this.loadToken;
      void this.loadForEmployee(tid, eid, token);
    });
  }

  private async loadForEmployee(tid: string, eid: string, token: number): Promise<void> {
    this.loading.set(true);
    this.searchQuery = '';
    this.dataSource.filter = '';
    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.paymentManagementDataService.loadPaymentSettings(tid),
          this.monthlySettingDataService.loadListSettings(tid),
        ]);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }

      const result = await this.listDataService.loadEmployeeMonthlyHistory(tid, eid);
      if (token !== this.loadToken) return;

      this.dataSource.data = result.rows;
    } catch (error) {
      if (token !== this.loadToken) return;
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  getColumnLabel(column: string): string {
    if (column === 'yyyyMm') return '対象月';
    return getMonthlyListColumnLabel(
      column as MonthlyListColumnKey,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
  }

  formatCellValue(row: MonthlyDetailRow, col: string): string {
    if (col === 'yyyyMm') {
      const [year, month] = row.yyyyMm.split('-');
      return `${year}年${parseInt(month, 10)}月`;
    }
    return formatMonthlyListCellValue(
      row,
      col as MonthlyListColumnKey,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery.toLowerCase(),
    });
  }

  async exportData(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid || this.dataSource.data.length === 0) return;

    await this.monthlySettingDataService.loadSettings(tid);
    const filtered = this.dataSource.filteredData;
    const sortedAndFilteredData = this.dataSource.sort
      ? this.dataSource.sortData(filtered, this.dataSource.sort)
      : filtered;

    const history = await this.listDataService.loadEmployeeMonthlyHistory(tid, eid);
    const fileLabel = history.employeeId || eid;
    const csv = this.exportService.buildEmployeeHistoryCsv(
      fileLabel,
      this.visibleColumns(),
      sortedAndFilteredData,
      this.monthlySettingDataService.importHeaders(),
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
    downloadCsvFile(`monthly-${fileLabel}.csv`, csv);
  }
}

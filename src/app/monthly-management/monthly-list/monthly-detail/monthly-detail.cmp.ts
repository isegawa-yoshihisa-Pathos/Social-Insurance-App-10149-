import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import { CurrentTenantService } from '../../../current-tenant.service';
import { MonthlySettingDataService } from '../../monthly-setting/monthly-setting-data.service';
import { PaymentManagementDataService } from '../../../payment-management/payment-management-data.service';
import { MonthlyDetailRow, MonthlyListDataService } from '../monthly-list-data.service';
import { MonthlyListColumnKey, getMonthlyListColumnLabel } from '../monthly-list-columns';
import { formatMonthlyListCellValue, monthlyListSortValue } from '../monthly-list-row.mapper';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-monthly-detail',
  imports: [
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    MatTooltipModule,
  ],
  templateUrl: './monthly-detail.cmp.html',
  styleUrl: './monthly-detail.cmp.css',
})
export class MonthlyDetailCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly listDataService = inject(MonthlyListDataService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  private loadToken = 0;
  private settingsLoadedTid: string | null = null;

  readonly eid = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('eid'))),
    { initialValue: null },
  );

  readonly employeeName = signal('');
  readonly employeeId = signal('');
  readonly loading = signal(true);

  dataSource = new MatTableDataSource<MonthlyDetailRow>([]);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  readonly visibleColumns = computed(() => {
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

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.dataSource.data = [];
        this.employeeName.set('');
        this.employeeId.set('');
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

      this.employeeName.set(result.displayName);
      this.employeeId.set(result.employeeId);
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

  redirectToMonthlyManagement(): void {
    void this.routesService.redirectToMonthlyManagement();
  }
}

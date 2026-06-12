import { Component, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { map } from 'rxjs';
import { CurrentTenantService } from '../../../current-tenant.service';
import { PaymentSettingDataService } from '../../payment-setting/payment-setting-data.service';
import { PaymentManagementDataService } from '../../../payment-management/payment-management-data.service';
import { PaymentDetailRow, EmployeeLookupEntry, PaymentListDataService } from '../payment-list-data.service';
import { PaymentListColumnKey, getPaymentListColumnLabel } from '../payment-list-columns';
import { formatPaymentListCellValue, paymentListSortValue } from '../payment-list-row.mapper';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';
import { BonusManagementDataService } from '../../../bonus-management/bonus-management-data.service';
import { TenantSettingDataService } from '../../../tenant-setting/tenant-setting-data.service';

@Component({
  selector: 'app-payment-detail',
  imports: [
    MatTableModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  templateUrl: './payment-detail.cmp.html',
  styleUrl: './payment-detail.cmp.css',
})
export class PaymentDetailCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly paymentSettingDataService = inject(PaymentSettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly listDataService = inject(PaymentListDataService);
  private readonly tenantSettingDataService = inject(TenantSettingDataService);
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
  readonly employees = signal<EmployeeLookupEntry[]>([]);
  readonly loading = signal(true);

  dataSource = new MatTableDataSource<PaymentDetailRow>([]);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  readonly visibleColumns = computed(() => {
    const baseColumns = this.paymentSettingDataService.visibleColumns();
    const filtered = baseColumns.filter(
      (col) => col !== 'displayName' && col !== 'employeeId',
    );
    return ['yyyyMm', ...filtered];
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) => {
      if (property === 'yyyyMm') return row.yyyyMm;
      return paymentListSortValue(
        row, 
        property as PaymentListColumnKey, 
        this.paymentManagementDataService.allowanceTypeDefinitions(), 
        this.bonusManagementDataService.bonusTypeDefinitions());
    };

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.dataSource.data = [];
        this.employeeName.set('');
        this.employeeId.set('');
        this.employees.set([]);
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
          this.paymentSettingDataService.loadListSettings(tid),
          this.tenantSettingDataService.loadAll(),
        ]);
        if (token !== this.loadToken) return;
        this.settingsLoadedTid = tid;
      }

      const [result, employeeLookup] = await Promise.all([
        this.listDataService.loadEmployeePaymentHistory(tid, eid),
        this.listDataService.loadEmployeeLookup(tid),
      ]);
      if (token !== this.loadToken) return;

      this.employees.set(this.sortEmployees([...employeeLookup.values()]));
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
    return getPaymentListColumnLabel(
      column as PaymentListColumnKey,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  formatCellValue(row: PaymentDetailRow, col: string): string {
    if (col === 'yyyyMm') {
      const [year, month] = row.yyyyMm.split('-');
      return `${year}年${parseInt(month, 10)}月`;
    }
    return formatPaymentListCellValue(
      row,
      col as PaymentListColumnKey,
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  redirectToPaymentManagement(): void {
    void this.routesService.redirectToPaymentManagement();
  }

  switchEmployee(eid: string): void {
    if (!eid || eid === this.eid()) return;
    void this.router.navigate(['/payment-management', 'detail', eid]);
  }

  private sortEmployees(employees: EmployeeLookupEntry[]): EmployeeLookupEntry[] {
    return employees.sort((a, b) => {
      const nameCompare = a.displayName.localeCompare(b.displayName, 'ja');
      if (nameCompare !== 0) return nameCompare;
      return a.employeeId.localeCompare(b.employeeId, 'ja');
    });
  }
}

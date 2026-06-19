import { Component, Input, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { buildImportStyleCsv, downloadCsvFile, formatExportNumber } from '../../csv/csv-file.util';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeeDetailDataService } from '../../employees-management/employees-list/employee-detail/employee-detail-data.service';
import {
  formatPaymentPeriodLabel,
  MainPagePaymentDataService,
  type MainPagePaymentScope,
} from '../main-page-payment-data.service';
import {
  getAllMonthlyListColumnKeysForEmployee,
  getMonthlyListColumnLabelForEmployee,
  MonthlyListColumnKeyForEmployee,
  MonthlyListRowForEmployee,
} from '../../monthly-management/monthly-list/monthly-list-columns';
import {
  BonusListColumnKeyForEmployee,
  BonusListRowForEmployee,
  getAllBonusListColumnKeysForEmployee,
  getBonusListColumnLabelForEmployee,
} from '../../bonus-management/bonus-list/bonus-list-columns';
import {
  bonusEmployeeExportValue,
  formatBonusEmployeeCellValue,
  formatMonthlyEmployeeCellValue,
  monthlyEmployeeExportValue,
} from '../main-page-payment-row.mapper';
import { Format } from '../../format-number-jp';

type PaymentTableRow = MonthlyListRowForEmployee | BonusListRowForEmployee;

@Component({
  selector: 'app-monthly-payment',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatTableModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './monthly-payment.cmp.html',
  styleUrl: './monthly-payment.cmp.css',
})
export class MonthlyPaymentCmp {
  @Input({ required: true }) scope!: MainPagePaymentScope;

  readonly eid = input.required<string>();

  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly employeeDetailDataService = inject(EmployeeDetailDataService);
  private readonly paymentDataService = inject(MainPagePaymentDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);

  readonly lockedPeriods = signal<string[]>([]);
  readonly selectedYyyyMm = signal<string | null>(null);
  readonly loadingPeriods = signal(false);
  readonly loadingRow = signal(false);
  readonly exporting = signal(false);
  readonly changeReasons = signal<string[]>([]);
  readonly tableDataSource = new MatTableDataSource<PaymentTableRow>([]);

  private loadToken = 0;
  private rowLoadToken = 0;
  private settingsLoadedTid: string | null = null;

  readonly hasLockedPeriods = computed(() => this.lockedPeriods().length > 0);
  readonly hasRow = computed(() => this.tableDataSource.data.length > 0);

  readonly netPayment = computed(() => {
    const row = this.tableDataSource.data[0];
    if (!row) return null;
    return row.totalPayment;
  });

  readonly netPaymentLabel = computed(() =>
    this.scope === 'monthly' ? '月次総支払' : '賞与総支払',
  );

  readonly tableColumns = computed(() =>
    this.scope === 'monthly'
      ? getAllMonthlyListColumnKeysForEmployee(
          this.paymentManagementDataService.allowanceTypeDefinitions(),
        )
      : getAllBonusListColumnKeysForEmployee(this.bonusManagementDataService.bonusTypeDefinitions()),
  );

  constructor() {
    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      const scope = this.scope;
      if (!tid || !eid) {
        untracked(() => this.resetState());
        return;
      }

      const token = ++this.loadToken;
      void this.loadLockedPeriods(tid, eid, scope, token);
    });
  }

  formatPeriodLabel(yyyyMm: string): string {
    return formatPaymentPeriodLabel(yyyyMm);
  }

  formatAmount(amount: number): string {
    return amount === 0 ? '0' : Format(amount);
  }

  onPeriodSelected(yyyyMm: string | null): void {
    if (!yyyyMm || yyyyMm === this.selectedYyyyMm()) {
      return;
    }

    this.selectedYyyyMm.set(yyyyMm);
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid) {
      return;
    }

    const token = ++this.rowLoadToken;
    void this.loadRow(tid, eid, yyyyMm, this.scope, token);
  }

  getColumnLabel(
    column: MonthlyListColumnKeyForEmployee | BonusListColumnKeyForEmployee,
  ): string {
    if (this.scope === 'monthly') {
      return getMonthlyListColumnLabelForEmployee(
        column as MonthlyListColumnKeyForEmployee,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
      );
    }
    return getBonusListColumnLabelForEmployee(
      column as BonusListColumnKeyForEmployee,
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  formatCellValue(
    row: PaymentTableRow,
    column: MonthlyListColumnKeyForEmployee | BonusListColumnKeyForEmployee,
  ): string {
    if (this.scope === 'monthly') {
      return formatMonthlyEmployeeCellValue(
        row as MonthlyListRowForEmployee,
        column as MonthlyListColumnKeyForEmployee,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
      );
    }

    return formatBonusEmployeeCellValue(row as BonusListRowForEmployee, column as BonusListColumnKeyForEmployee);
  }

  async exportData(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const yyyyMm = this.selectedYyyyMm();
    if (!tid || !yyyyMm || !this.hasRow() || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    try {
      const allowanceDefinitions =
        this.paymentManagementDataService.allowanceTypeDefinitions();
      const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
      await Promise.all([
        this.paymentManagementDataService.loadPaymentSettings(tid),
        this.bonusManagementDataService.loadBonusSettings(tid),
      ]);

      const prefix = this.scope === 'monthly' ? 'monthly' : 'bonus';
      const row = this.tableDataSource.data[0];
      if (!row) {
        return;
      }

      const columns = this.tableColumns();
      const headers = columns.map((column) => this.getColumnLabel(column));
      const dataRow = columns.map((column) => {
        const value =
          this.scope === 'monthly'
            ? monthlyEmployeeExportValue(row as MonthlyListRowForEmployee, column as MonthlyListColumnKeyForEmployee)
            : bonusEmployeeExportValue(row as BonusListRowForEmployee, column as BonusListColumnKeyForEmployee);
        return typeof value === 'number' ? formatExportNumber(value) : String(value ?? '');
      });

      const csv = buildImportStyleCsv(yyyyMm, headers, [dataRow]);
      downloadCsvFile(`${prefix}-${yyyyMm}.csv`, csv);
    } finally {
      this.exporting.set(false);
    }
  }

  private resetState(): void {
    this.lockedPeriods.set([]);
    this.selectedYyyyMm.set(null);
    this.tableDataSource.data = [];
    this.changeReasons.set([]);
    this.loadingPeriods.set(false);
    this.loadingRow.set(false);
  }

  private setLockedPeriods(periods: string[]): void {
    const current = this.lockedPeriods();
    if (
      current.length === periods.length &&
      current.every((value, index) => value === periods[index])
    ) {
      return;
    }
    this.lockedPeriods.set(periods);
  }

  private setTableRow(row: PaymentTableRow | null, changeReasons: string[] = []): void {
    this.tableDataSource.data = row ? [row] : [];
    this.changeReasons.set(changeReasons);
  }

  private async loadLockedPeriods(
    tid: string,
    eid: string,
    scope: MainPagePaymentScope,
    token: number,
  ): Promise<void> {
    this.loadingPeriods.set(true);
    this.loadingRow.set(false);
    untracked(() => {
      this.selectedYyyyMm.set(null);
      this.setTableRow(null);
    });

    try {
      if (this.settingsLoadedTid !== tid) {
        await Promise.all([
          this.paymentManagementDataService.loadPaymentSettings(tid),
          this.bonusManagementDataService.loadBonusSettings(tid),
        ]);
        if (token !== this.loadToken) {
          return;
        }
        this.settingsLoadedTid = tid;
      }

      const periods = await this.paymentDataService.loadLockedPeriods(tid, eid, scope);
      if (token !== this.loadToken) {
        return;
      }

      this.setLockedPeriods(periods);
      const initialPeriod = periods[0] ?? null;
      if (!initialPeriod) {
        return;
      }

      this.selectedYyyyMm.set(initialPeriod);
      const rowToken = ++this.rowLoadToken;
      await this.loadRow(tid, eid, initialPeriod, scope, rowToken);
    } finally {
      if (token === this.loadToken) {
        this.loadingPeriods.set(false);
      }
    }
  }

  private async loadRow(
    tid: string,
    eid: string,
    yyyyMm: string,
    scope: MainPagePaymentScope,
    token: number,
  ): Promise<void> {
    this.loadingRow.set(true);
    try {
      const meta = {
        employeeId: this.employeeDetailDataService.employForm.employeeId,
        displayName: this.employeeDetailDataService.personalForm.displayName,
        birthDate: this.employeeDetailDataService.personalForm.birthDate,
      };

      const result =
        scope === 'monthly'
          ? await this.paymentDataService.loadMonthlyRow(tid, eid, yyyyMm, meta)
          : await this.paymentDataService.loadBonusRow(tid, eid, yyyyMm, meta);

      if (token !== this.rowLoadToken) {
        return;
      }

      this.setTableRow(result.row, result.changeReasons);
    } finally {
      if (token === this.rowLoadToken) {
        this.loadingRow.set(false);
      }
    }
  }
}

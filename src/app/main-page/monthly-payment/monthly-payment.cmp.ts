import { Component, Input, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MonthlyListExportService } from '../../monthly-management/monthly-list/monthly-list-export.service';
import { BonusListExportService } from '../../bonus-management/bonus-list/bonus-list-export.service';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { BonusManagementDataService } from '../../bonus-management/bonus-management-data.service';
import { downloadCsvFile } from '../../csv/csv-file.util';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeeDetailDataService } from '../../employees-management/employees-list/employee-detail/employee-detail-data.service';
import {
  formatPaymentPeriodLabel,
  MainPagePaymentDataService,
  type MainPagePaymentScope,
} from '../main-page-payment-data.service';
import {
  getAllMonthlyListColumnKeys,
  getMonthlyListColumnLabel,
  MonthlyListColumnKey,
  MonthlyListRow,
} from '../../monthly-management/monthly-list/monthly-list-columns';
import {
  formatMonthlyListCellValue,
} from '../../monthly-management/monthly-list/monthly-list-row.mapper';
import {
  BonusListColumnKey,
  BonusListRow,
  getAllBonusListColumnKeys,
  getBonusListColumnLabel,
} from '../../bonus-management/bonus-list/bonus-list-columns';
import { formatBonusListCellValue } from '../../bonus-management/bonus-list/bonus-list-row.mapper';

type PaymentTableRow = MonthlyListRow | BonusListRow;

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
  private readonly monthlyListExportService = inject(MonthlyListExportService);
  private readonly bonusListExportService = inject(BonusListExportService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);

  readonly lockedPeriods = signal<string[]>([]);
  readonly selectedYyyyMm = signal<string | null>(null);
  readonly loadingPeriods = signal(false);
  readonly loadingRow = signal(false);
  readonly exporting = signal(false);
  readonly tableDataSource = new MatTableDataSource<PaymentTableRow>([]);

  private loadToken = 0;
  private rowLoadToken = 0;
  private settingsLoadedTid: string | null = null;

  readonly hasLockedPeriods = computed(() => this.lockedPeriods().length > 0);
  readonly hasRow = computed(() => this.tableDataSource.data.length > 0);

  readonly tableColumns = computed(() =>
    this.scope === 'monthly'
      ? getAllMonthlyListColumnKeys(
          this.paymentManagementDataService.allowanceTypeDefinitions(),
        )
      : getAllBonusListColumnKeys(this.bonusManagementDataService.bonusTypeDefinitions()),
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

  getColumnLabel(column: MonthlyListColumnKey | BonusListColumnKey): string {
    if (this.scope === 'monthly') {
      return getMonthlyListColumnLabel(
        column as MonthlyListColumnKey,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
      );
    }
    return getBonusListColumnLabel(
      column as BonusListColumnKey,
      this.bonusManagementDataService.bonusTypeDefinitions(),
    );
  }

  formatCellValue(row: PaymentTableRow, column: MonthlyListColumnKey | BonusListColumnKey): string {
    if (this.scope === 'monthly') {
      return formatMonthlyListCellValue(
        row as MonthlyListRow,
        column as MonthlyListColumnKey,
        this.paymentManagementDataService.allowanceTypeDefinitions(),
      );
    }

    return formatBonusListCellValue(row as BonusListRow, column as BonusListColumnKey);
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

      if (this.scope === 'monthly') {
        const csv = this.monthlyListExportService.buildCsv(
          yyyyMm,
          this.tableColumns() as MonthlyListColumnKey[],
          [row as MonthlyListRow],
          {},
          allowanceDefinitions,
        );
        downloadCsvFile(`${prefix}-${yyyyMm}.csv`, csv);
        return;
      }

      const csv = this.bonusListExportService.buildCsv(
        yyyyMm,
        this.tableColumns() as BonusListColumnKey[],
        [row as BonusListRow],
        {},
        bonusDefinitions,
      );
      downloadCsvFile(`${prefix}-${yyyyMm}.csv`, csv);
    } finally {
      this.exporting.set(false);
    }
  }

  private resetState(): void {
    this.lockedPeriods.set([]);
    this.selectedYyyyMm.set(null);
    this.tableDataSource.data = [];
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

  private setTableRow(row: PaymentTableRow | null): void {
    this.tableDataSource.data = row ? [row] : [];
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
      };

      const row =
        scope === 'monthly'
          ? await this.paymentDataService.loadMonthlyRow(tid, eid, yyyyMm, meta)
          : await this.paymentDataService.loadBonusRow(tid, eid, yyyyMm, meta);

      if (token !== this.rowLoadToken) {
        return;
      }

      this.setTableRow(row);
    } finally {
      if (token === this.rowLoadToken) {
        this.loadingRow.set(false);
      }
    }
  }
}

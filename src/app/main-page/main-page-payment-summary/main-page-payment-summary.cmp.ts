import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeeDetailDataService } from '../../employees-management/employees-list/employee-detail/employee-detail-data.service';
import {
  formatPaymentPeriodLabel,
  MainPagePaymentDataService,
} from '../main-page-payment-data.service';
import { Format } from '../../format-number-jp';

interface PaymentSummaryAmounts {
  monthly: number;
  bonus: number;
  total: number;
}

@Component({
  selector: 'app-main-page-payment-summary',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './main-page-payment-summary.cmp.html',
  styleUrl: './main-page-payment-summary.cmp.css',
})
export class MainPagePaymentSummaryCmp {
  readonly eid = input.required<string>();

  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly employeeDetailDataService = inject(EmployeeDetailDataService);
  private readonly paymentDataService = inject(MainPagePaymentDataService);

  readonly displayMonths = signal<string[]>([]);
  readonly selectedYyyyMm = signal<string | null>(null);
  readonly loading = signal(false);
  readonly amounts = signal<PaymentSummaryAmounts | null>(null);

  private loadToken = 0;

  readonly hasDisplayMonths = computed(() => this.displayMonths().length > 0);

  constructor() {
    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        untracked(() => this.resetState());
        return;
      }

      const token = ++this.loadToken;
      void this.loadPeriods(tid, eid, token);
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

    void this.loadSummary(tid, eid, yyyyMm);
  }

  private resetState(): void {
    this.displayMonths.set([]);
    this.selectedYyyyMm.set(null);
    this.amounts.set(null);
    this.loading.set(false);
  }

  private async loadPeriods(tid: string, eid: string, token: number): Promise<void> {
    this.loading.set(true);
    this.amounts.set(null);
    untracked(() => this.selectedYyyyMm.set(null));

    try {
      const periods = await this.paymentDataService.loadPaymentSummaryDisplayMonths(tid, eid);
      if (token !== this.loadToken) {
        return;
      }

      this.displayMonths.set(periods);

      const initialPeriod = periods[0] ?? null;
      if (!initialPeriod) {
        return;
      }

      this.selectedYyyyMm.set(initialPeriod);
      await this.loadSummary(tid, eid, initialPeriod);
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  private async loadSummary(tid: string, eid: string, displayYyyyMm: string): Promise<void> {
    this.loading.set(true);
    try {
      const summary = await this.paymentDataService.loadPaymentSummaryAmounts(
        tid,
        eid,
        displayYyyyMm,
        {
          birthDate: this.employeeDetailDataService.personalForm.birthDate,
        },
      );
      this.amounts.set(summary);
    } finally {
      this.loading.set(false);
    }
  }
}

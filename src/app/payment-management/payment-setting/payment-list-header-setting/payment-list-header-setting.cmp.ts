import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { PaymentSettingDataService } from '../payment-setting-data.service';
import { PaymentManagementDataService } from '../../payment-management-data.service';
import { BonusManagementDataService } from '../../../bonus-management/bonus-management-data.service';
import {
  getOptionalPaymentListColumns,
  PaymentListColumnKey,
} from '../../payment-list/payment-list-columns';

@Component({
  selector: 'app-payment-list-header-setting',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './payment-list-header-setting.cmp.html',
  styleUrl: './payment-list-header-setting.cmp.css',
})
export class PaymentListHeaderSettingCmp implements OnInit {
  private readonly paymentSettingDataService = inject(PaymentSettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

  readonly optionalColumns = computed(() =>
    getOptionalPaymentListColumns(
      this.paymentManagementDataService.allowanceTypeDefinitions(),
      this.bonusManagementDataService.bonusTypeDefinitions(),
    ),
  );

  loading = false;
  saveBusy = false;

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }
    this.loading = true;
    try {
      await Promise.all([
        this.paymentManagementDataService.loadPaymentSettings(tid),
        this.bonusManagementDataService.loadBonusSettings(tid),
      ]);
      await this.paymentSettingDataService.loadListSettings(tid);
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  isChecked(key: PaymentListColumnKey): boolean {
    return this.paymentSettingDataService.isColumnVisible(key);
  }

  onOptionalChange(key: PaymentListColumnKey, checked: boolean): void {
    this.paymentSettingDataService.toggleOptionalColumn(key, checked);
  }

  isAllSelected(): boolean {
    return this.optionalColumns().every((col) => this.isChecked(col.key));
  }

  toggleAll(checked: boolean): void {
    this.optionalColumns().forEach((col) => this.onOptionalChange(col.key, checked));
  }

  async save(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) return;
    this.saveBusy = true;
    try {
      await this.paymentSettingDataService.saveListSettings(tid);
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.saveBusy = false;
    }
  }
}

import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
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
import {
  buildOrderedColumnOptions,
  OrderedListColumnOption,
  visibleColumnsFromOrder,
} from '../../../list-column-order.util';

@Component({
  selector: 'app-payment-list-header-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  templateUrl: './payment-list-header-setting.cmp.html',
  styleUrls: ['./payment-list-header-setting.cmp.css', '../../../list-header-setting.cmp.css'],
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

  orderedColumns: OrderedListColumnOption<PaymentListColumnKey>[] = [];
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
      this.refreshOrderedColumns();
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  drop(event: CdkDragDrop<OrderedListColumnOption<PaymentListColumnKey>[]>): void {
    moveItemInArray(this.orderedColumns, event.previousIndex, event.currentIndex);
    this.syncVisibleColumns();
  }

  onCheckedChange(): void {
    this.syncVisibleColumns();
  }

  isAllSelected(): boolean {
    return this.orderedColumns.length > 0 && this.orderedColumns.every((col) => col.checked);
  }

  toggleAll(checked: boolean): void {
    this.orderedColumns = this.orderedColumns.map((col) => ({ ...col, checked }));
    this.syncVisibleColumns();
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

  private refreshOrderedColumns(): void {
    this.orderedColumns = buildOrderedColumnOptions(
      this.optionalColumns(),
      this.paymentSettingDataService.visibleColumns(),
    );
  }

  private syncVisibleColumns(): void {
    this.paymentSettingDataService.setVisibleColumns(
      visibleColumnsFromOrder(this.orderedColumns),
    );
  }
}

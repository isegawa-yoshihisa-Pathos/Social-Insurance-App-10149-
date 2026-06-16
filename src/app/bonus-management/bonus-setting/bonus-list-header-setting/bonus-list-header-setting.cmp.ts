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
import { BonusSettingDataService } from '../bonus-setting-data.service';
import {
  getOptionalBonusListColumns,
  BonusListColumnKey,
} from '../../bonus-list/bonus-list-columns';
import { BonusManagementDataService } from '../../bonus-management-data.service';
import {
  buildOrderedColumnOptions,
  OrderedListColumnOption,
  visibleColumnsFromOrder,
} from '../../../list-column-order.util';

@Component({
  selector: 'app-bonus-list-header-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  templateUrl: './bonus-list-header-setting.cmp.html',
  styleUrls: ['./bonus-list-header-setting.cmp.css', '../../../list-header-setting.cmp.css'],
})
export class BonusListHeaderSettingCmp implements OnInit {
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  readonly bonusManagementDataService = inject(BonusManagementDataService);

  readonly optionalColumns = computed(() =>
    getOptionalBonusListColumns(this.bonusManagementDataService.bonusTypeDefinitions()),
  );

  orderedColumns: OrderedListColumnOption<BonusListColumnKey>[] = [];
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
      await this.bonusSettingDataService.loadListSettings(tid);
      this.refreshOrderedColumns();
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  drop(event: CdkDragDrop<OrderedListColumnOption<BonusListColumnKey>[]>): void {
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
      await this.bonusSettingDataService.saveListSettings(tid);
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
      this.bonusSettingDataService.visibleColumns(),
    );
  }

  private syncVisibleColumns(): void {
    this.bonusSettingDataService.setVisibleColumns(
      visibleColumnsFromOrder(this.orderedColumns),
    );
  }
}

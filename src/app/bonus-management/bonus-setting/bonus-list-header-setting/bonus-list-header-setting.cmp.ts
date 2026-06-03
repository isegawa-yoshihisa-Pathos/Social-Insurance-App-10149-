import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

@Component({
  selector: 'app-bonus-list-header-setting',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './bonus-list-header-setting.cmp.html',
  styleUrl: './bonus-list-header-setting.cmp.css',
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
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  isChecked(key: BonusListColumnKey): boolean {
    return this.bonusSettingDataService.isColumnVisible(key);
  }

  onOptionalChange(key: BonusListColumnKey, checked: boolean): void {
    this.bonusSettingDataService.toggleOptionalColumn(key, checked);
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
      await this.bonusSettingDataService.saveListSettings(tid);
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.saveBusy = false;
    }
  }
}

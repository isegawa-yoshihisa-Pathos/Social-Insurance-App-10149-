import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { MonthlySettingDataService } from '../monthly-setting-data.service';
import { MonthlyManagementDataService } from '../../monthly-management-data.service';
import {
  getOptionalMonthlyListColumns,
  MonthlyListColumnKey,
} from '../../monthly-list/monthly-list-columns';

@Component({
  selector: 'app-monthly-list-header-setting',
  imports: [FormsModule, MatButtonModule, MatCheckboxModule, MatProgressSpinnerModule],
  templateUrl: './monthly-list-header-setting.cmp.html',
  styleUrl: './monthly-list-header-setting.cmp.css',
})
export class MonthlyListHeaderSettingCmp implements OnInit {
  private readonly monthlyManagementDataService = inject(MonthlyManagementDataService);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

  readonly optionalColumns = computed(() =>
    getOptionalMonthlyListColumns(this.monthlyManagementDataService.bonusTypeDefinitions()),
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
      await this.monthlySettingDataService.loadListSettings(tid);
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  isChecked(key: MonthlyListColumnKey): boolean {
    return this.monthlySettingDataService.isColumnVisible(key);
  }

  onOptionalChange(key: MonthlyListColumnKey, checked: boolean): void {
    this.monthlySettingDataService.toggleOptionalColumn(key, checked);
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
      await this.monthlySettingDataService.saveListSettings(tid);
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.saveBusy = false;
    }
  }
}

import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { EmployeesManagementDataService } from '../../employees-management-data.service';
import {
  OPTIONAL_EMPLOYEE_LIST_COLUMNS,
  EmployeeListColumnKey,
} from '../../employees-list/employee-list-columns';
import {
  buildOrderedColumnOptions,
  OrderedListColumnOption,
  visibleColumnsFromOrder,
} from '../../../list-column-order.util';

@Component({
  selector: 'app-employees-list-header-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DragDropModule,
  ],
  templateUrl: './employees-list-header-setting.cmp.html',
  styleUrls: ['./employees-list-header-setting.cmp.css', '../../../list-header-setting.cmp.css'],
})
export class EmployeesListHeaderSettingCmp implements OnInit {
  readonly dataService = inject(EmployeesManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

  readonly optionalColumns = OPTIONAL_EMPLOYEE_LIST_COLUMNS;

  orderedColumns: OrderedListColumnOption<EmployeeListColumnKey>[] = [];
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
      await this.dataService.loadListSettings(tid);
      this.refreshOrderedColumns();
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  drop(event: CdkDragDrop<OrderedListColumnOption<EmployeeListColumnKey>[]>): void {
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
      await this.dataService.saveListSettings(tid);
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
      this.optionalColumns,
      this.dataService.visibleColumns(),
    );
  }

  private syncVisibleColumns(): void {
    this.dataService.setVisibleColumns(
      visibleColumnsFromOrder(this.orderedColumns),
    );
  }
}

import { Component, computed, inject, OnInit } from '@angular/core';
import { Firestore, doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { EmployeesManagementDataService } from '../../employees-management-data.service';
import {
  buildEmployeesImportColumnDefs,
  EmployeesImportColumnDef,
  EmployeesImportFieldKey,
} from '../employees-import-columns';
import { EmployeesSettingDataService } from '../employees-setting-data.service';

@Component({
  selector: 'app-employees-import-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './employees-import-setting.cmp.html',
  styleUrl: './employees-import-setting.cmp.css',
})
export class EmployeesImportSettingCmp implements OnInit {
  readonly employeesSettingDataService = inject(EmployeesSettingDataService);
  private readonly employeesManagementDataService = inject(EmployeesManagementDataService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);

  readonly importColumns = computed((): EmployeesImportColumnDef[] =>
    buildEmployeesImportColumnDefs(),
  );

  loading = false;
  saveBusy = false;
  newHeaderByKey: Record<string, string> = {};

  private tid = '';

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }
    this.tid = tid;

    this.loading = true;
    try {
      await this.employeesSettingDataService.loadSettings(tid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  currentHeader(key: EmployeesImportFieldKey): string {
    return this.employeesSettingDataService.importHeaders()[key] ?? '';
  }

  newHeaderInput(key: EmployeesImportFieldKey): string {
    return this.newHeaderByKey[key] ?? '';
  }

  setNewHeaderInput(key: EmployeesImportFieldKey, value: string): void {
    this.newHeaderByKey[key] = value;
  }

  async changeHeader(key: EmployeesImportFieldKey): Promise<void> {
    const header = (this.newHeaderByKey[key] ?? '').trim();
    if (!header) {
      return;
    }

    if (!this.tid) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: '事業所が選択されていません' },
      });
      return;
    }

    this.employeesSettingDataService.setHeader(key, header);

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'employeesSetting');
      await setDoc(
        docRef,
        {
          importHeaders: this.employeesSettingDataService.importHeaders(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      const { [key]: _, ...rest } = this.newHeaderByKey;
      this.newHeaderByKey = rest;
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.saveBusy = false;
    }
  }
}

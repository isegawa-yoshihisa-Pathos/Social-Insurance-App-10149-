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
import {
  buildMonthlyImportColumnDefs,
  MonthlyImportColumnDef,
  MonthlyImportFieldKey,
} from '../monthly-import-columns';
import { MonthlySettingDataService } from '../monthly-setting-data.service';

@Component({
  selector: 'app-monthly-import-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './monthly-import-setting.cmp.html',
  styleUrl: './monthly-import-setting.cmp.css',
})
export class MonthlyImportSettingCmp implements OnInit {
  readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);

  readonly importColumns = computed((): MonthlyImportColumnDef[] =>
    buildMonthlyImportColumnDefs(),
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
      await this.monthlySettingDataService.loadSettings(
        tid,
      );
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  currentHeader(key: MonthlyImportFieldKey): string {
    return this.monthlySettingDataService.importHeaders()[key] ?? '';
  }

  newHeaderInput(key: MonthlyImportFieldKey): string {
    return this.newHeaderByKey[key] ?? '';
  }

  setNewHeaderInput(key: MonthlyImportFieldKey, value: string): void {
    this.newHeaderByKey[key] = value;
  }

  async changeHeader(key: MonthlyImportFieldKey): Promise<void> {
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

    this.monthlySettingDataService.setHeader(key, header);

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'monthlySetting');
      await setDoc(
        docRef,
        {
          importHeaders: this.monthlySettingDataService.importHeaders(),
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

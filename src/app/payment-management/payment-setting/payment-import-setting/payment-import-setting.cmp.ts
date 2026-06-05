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
  buildPaymentImportColumnDefs,
  PaymentImportColumnDef,
  PaymentImportFieldKey,
} from '../payment-import-columns';
import { PaymentSettingDataService } from '../payment-setting-data.service';
import { PaymentManagementDataService } from '../../payment-management-data.service';

@Component({
  selector: 'app-payment-import-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './payment-import-setting.cmp.html',
  styleUrl: './payment-import-setting.cmp.css',
})
export class PaymentImportSettingCmp implements OnInit {
  readonly paymentSettingDataService = inject(PaymentSettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);

  readonly importColumns = computed((): PaymentImportColumnDef[] =>
    buildPaymentImportColumnDefs(this.paymentManagementDataService.allowanceTypeDefinitions()),
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
      await this.paymentSettingDataService.loadSettings(
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

  currentHeader(key: PaymentImportFieldKey): string {
    return this.paymentSettingDataService.importHeaders()[key] ?? '';
  }

  newHeaderInput(key: PaymentImportFieldKey): string {
    return this.newHeaderByKey[key] ?? '';
  }

  setNewHeaderInput(key: PaymentImportFieldKey, value: string): void {
    this.newHeaderByKey[key] = value;
  }

  async changeHeader(key: PaymentImportFieldKey): Promise<void> {
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

    this.paymentSettingDataService.setHeader(key, header);

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'paymentSetting');
      await setDoc(
        docRef,
        {
          importHeaders: this.paymentSettingDataService.importHeaders(),
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

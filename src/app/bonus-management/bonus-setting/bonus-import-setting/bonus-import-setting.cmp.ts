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
  buildBonusImportColumnDefs,
  BonusImportColumnDef,
  BonusImportFieldKey,
} from '../bonus-import-columns';
import { BonusSettingDataService } from '../bonus-setting-data.service';
import { BonusManagementDataService } from '../../bonus-management-data.service';

@Component({
  selector: 'app-bonus-import-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './bonus-import-setting.cmp.html',
  styleUrl: './bonus-import-setting.cmp.css',
})
export class BonusImportSettingCmp implements OnInit {
  readonly bonusSettingDataService = inject(BonusSettingDataService);
  readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly dialog = inject(MatDialog);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly firestore = inject(Firestore);

  readonly importColumns = computed((): BonusImportColumnDef[] =>
    buildBonusImportColumnDefs(this.bonusManagementDataService.bonusTypeDefinitions()),
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
      await this.bonusSettingDataService.loadSettings(
        tid,
        this.bonusManagementDataService.bonusTypeDefinitions(),
      );
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.loading = false;
    }
  }

  currentHeader(key: BonusImportFieldKey): string {
    return this.bonusSettingDataService.importHeaders()[key] ?? '';
  }

  newHeaderInput(key: BonusImportFieldKey): string {
    return this.newHeaderByKey[key] ?? '';
  }

  setNewHeaderInput(key: BonusImportFieldKey, value: string): void {
    this.newHeaderByKey[key] = value;
  }

  async changeHeader(key: BonusImportFieldKey): Promise<void> {
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

    this.bonusSettingDataService.setHeader(key, header);

    try {
      this.saveBusy = true;
      const docRef = doc(this.firestore, 'tenants', this.tid, 'settings', 'bonusSetting');
      await setDoc(
        docRef,
        {
          importHeaders: this.bonusSettingDataService.importHeaders(),
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

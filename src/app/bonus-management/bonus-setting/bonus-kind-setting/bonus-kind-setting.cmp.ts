import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { BonusTypeDefinition } from '../../../bonus-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { BonusManagementDataService } from '../../bonus-management-data.service';
import { generateNextBonusType } from '../../bonus-list/bonus-type.util';
import { BonusSettingDataService } from '../bonus-setting-data.service';

@Component({
  selector: 'app-bonus-kind-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './bonus-kind-setting.cmp.html',
  styleUrl: './bonus-kind-setting.cmp.css',
})
export class BonusKindSettingCmp implements OnInit {
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  loading = false;
  saveBusy = false;
  validationError: string | null = null;
  types: BonusTypeDefinition[] = [];

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }

    this.loading = true;
    try {
      await this.bonusManagementDataService.loadBonusSettings(tid);
      this.types = this.bonusManagementDataService.bonusTypeDefinitions().map((item) => ({ ...item }));
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  addType(): void {
    const type = generateNextBonusType(this.types.map((item) => item.type));
    this.types.push({ label: '', type, bonusFrequency: 'low', target: 'labor' });
    this.validationError = null;
  }

  async save(): Promise<void> {
    const error = this.validateTypes(this.types);
    if (error) {
      this.validationError = error;
      return;
    }

    const tid = this.currentTenantService.currentTid();
    if (!tid) return;

    this.saveBusy = true;
    this.validationError = null;
    try {
      this.bonusManagementDataService.setBonusTypeDefinitions(this.types);
      await this.bonusManagementDataService.saveBonusSettings(tid);
      this.bonusSettingDataService.syncVisibleColumnsForBonusTypes();
      this.types = this.bonusManagementDataService.bonusTypeDefinitions().map((item) => ({ ...item }));
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  private validateTypes(types: BonusTypeDefinition[]): string | null {
    const seenLabels = new Set<string>();

    for (const item of types) {
      const label = item.label.trim();
      if (!label) {
        return '表示名は必須です。';
      }
      if (seenLabels.has(label)) {
        return `表示名 "${label}" が重複しています。`;
      }
      seenLabels.add(label);
    }

    return null;
  }
}
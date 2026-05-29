import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { BonusTypeDefinition } from '../../../monthly-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { MonthlyManagementDataService } from '../../monthly-management-data.service';
import { generateNextBonusType } from '../../monthly-list/bonus-type.util';

@Component({
  selector: 'app-monthly-bonus-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './monthly-bonus-setting.cmp.html',
  styleUrl: './monthly-bonus-setting.cmp.css',
})
export class MonthlyBonusSettingCmp implements OnInit {
  private readonly dataService = inject(MonthlyManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

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
      await this.dataService.loadBonusSettings(tid);
      this.types = this.dataService.bonusTypeDefinitions().map((item) => ({ ...item }));
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
    this.types.push({ label: '', type });
    this.validationError = null;
  }

  removeType(index: number): void {
    if (this.types.length <= 1) return;
    this.types.splice(index, 1);
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
      this.dataService.setBonusTypeDefinitions(this.types);
      await this.dataService.saveBonusSettings(tid);
      this.types = this.dataService.bonusTypeDefinitions().map((item) => ({ ...item }));
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

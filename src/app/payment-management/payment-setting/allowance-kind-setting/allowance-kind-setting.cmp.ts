import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { AllowanceTypeDefinition, WageCategory } from '../../../payment-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { CurrentTenantService } from '../../../current-tenant.service';
import { RoutesService } from '../../../routes.service';
import { PaymentManagementDataService } from '../../payment-management-data.service';
import { generateNextAllowanceType } from '../../payment-list/allowance-type.util';

@Component({
  selector: 'app-allowance-kind-setting',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './allowance-kind-setting.cmp.html',
  styleUrl: './allowance-kind-setting.cmp.css',
})
export class AllowanceKindSettingCmp implements OnInit {
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);
  loading = false;
  saveBusy = false;
  validationError: string | null = null;
  types: AllowanceTypeDefinition[] = [];

  readonly wageCategoryOptions: { value: WageCategory; label: string }[] = [
    { value: 'fixed', label: '固定的賃金' },
    { value: 'variable', label: '非固定的賃金' },
  ];

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      this.routesService.redirectToHome();
      return;
    }

    this.loading = true;
    try {
      await this.paymentManagementDataService.loadPaymentSettings(tid);
      this.types = this.paymentManagementDataService
        .allowanceTypeDefinitions()
        .map((item) => ({ ...item }));
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.loading = false;
    }
  }

  addType(): void {
    const type = generateNextAllowanceType(this.types.map((item) => item.type));
    this.types.push({ label: '', type, wageCategory: 'variable' });
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
      this.paymentManagementDataService.setAllowanceTypeDefinitions(this.types);
      await this.paymentManagementDataService.savePaymentSettings(tid);
      this.types = this.paymentManagementDataService
        .allowanceTypeDefinitions()
        .map((item) => ({ ...item }));
    } catch (e) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(e) },
      });
    } finally {
      this.saveBusy = false;
    }
  }

  private validateTypes(types: AllowanceTypeDefinition[]): string | null {
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

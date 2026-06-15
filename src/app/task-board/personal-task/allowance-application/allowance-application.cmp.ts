import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApplicationDataService } from '../../application-data.service';
import {
  AllowanceApplicationFormData,
  buildApplyMonthOptions,
  createEmptyAllowanceApplicationForm,
  formatApplyMonthLabel,
} from '../../allowance-application.util';
import { CurrentTenantService } from '../../../current-tenant.service';
import { PaymentManagementDataService } from '../../../payment-management/payment-management-data.service';
import { AllowanceTypeDefinition } from '../../../payment-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-allowance-application',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './allowance-application.cmp.html',
  styleUrl: './allowance-application.cmp.css',
})
export class AllowanceApplicationCmp implements OnInit {
  private readonly applicationDataService = inject(ApplicationDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  readonly form: AllowanceApplicationFormData = createEmptyAllowanceApplicationForm();
  readonly applyMonthOptions = buildApplyMonthOptions();
  readonly formatApplyMonthLabel = formatApplyMonthLabel;

  allowanceTypes: AllowanceTypeDefinition[] = [];
  submitBusy = false;

  async ngOnInit(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    if (!tid) {
      return;
    }

    try {
      await this.paymentManagementDataService.loadPaymentSettings(tid);
      this.allowanceTypes = this.paymentManagementDataService.allowanceTypeDefinitions();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
  }

  async submit(): Promise<void> {
    this.submitBusy = true;
    try {
      await this.applicationDataService.submitAllowanceApplication(
        this.form,
        this.allowanceTypes,
      );
      this.dialog.open(SuccessDialogCmp, {
        data: {
          message:
            '諸手当申請を送信しました。管理者の承認後、給与データへは自動反映されません。',
        },
      });
      this.routesService.redirectToTaskBoard();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }

  cancel(): void {
    this.routesService.redirectToTaskBoard();
  }
}

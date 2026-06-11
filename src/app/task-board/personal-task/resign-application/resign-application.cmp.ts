import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApplicationDataService } from '../../application-data.service';
import { createEmptyResignForm } from '../../../employee-leave.util';
import { EmployeeResignFormData } from '../../../employee-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-resign-application',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatDatepickerToggle,
    MatProgressSpinnerModule,
  ],
  templateUrl: './resign-application.cmp.html',
  styleUrl: './resign-application.cmp.css',
})
export class ResignApplicationCmp {
  private readonly applicationDataService = inject(ApplicationDataService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  readonly form: EmployeeResignFormData = createEmptyResignForm();
  submitBusy = false;

  async submit(): Promise<void> {
    this.submitBusy = true;
    try {
      await this.applicationDataService.submitResignApplication(this.form);
      this.dialog.open(SuccessDialogCmp, {
        data: { message: '退職申請を送信しました。' },
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

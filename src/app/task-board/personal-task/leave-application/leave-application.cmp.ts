import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApplicationDataService } from '../../application-data.service';
import { createEmptyLeaveForm, EMPLOYEE_LEAVE_TYPE_LABELS } from '../../../employee-leave.util';
import { EmployeeLeaveFormData } from '../../../employee-document';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../success-dialog/success-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-leave-application',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatDatepickerToggle,
    MatProgressSpinnerModule,
  ],
  templateUrl: './leave-application.cmp.html',
  styleUrl: './leave-application.cmp.css',
})
export class LeaveApplicationCmp {
  private readonly applicationDataService = inject(ApplicationDataService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  readonly leaveTypeLabels = EMPLOYEE_LEAVE_TYPE_LABELS;
  readonly form: EmployeeLeaveFormData = createEmptyLeaveForm();
  submitBusy = false;

  async submit(): Promise<void> {
    this.submitBusy = true;
    try {
      await this.applicationDataService.submitLeaveApplication(this.form);
      this.dialog.open(SuccessDialogCmp, {
        data: { message: '休暇申請を送信しました。' },
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

import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';
import { ErrorDialogCmp, mapFirebaseError } from '../../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../../routes.service';
import { EmployeeDetailDataService } from '../employee-detail-data.service';

@Component({
  selector: 'app-employee-employ-detail-edit',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatDatepickerToggle,
  ],
  templateUrl: './employee-employ-detail-edit.cmp.html',
  styleUrls: [
    './employee-employ-detail-edit.cmp.css',
    '../../../../personal-setting/personal-setting.cmp.css',
  ],
})
export class EmployeeEmployDetailEditCmp {
  readonly dataService = inject(EmployeeDetailDataService);
  private readonly routesService = inject(RoutesService);
  private readonly dialog = inject(MatDialog);

  submitBusy = false;

  get employForm() {
    return this.dataService.employForm;
  }

  async save(): Promise<void> {
    this.submitBusy = true;
    try {
      await this.dataService.saveEmploy();
      this.routesService.redirectToEmployeeEmployDetail(this.dataService.eid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.submitBusy = false;
    }
  }

  cancel(): void {
    this.routesService.redirectToEmployeeEmployDetail(this.dataService.eid);
  }
}

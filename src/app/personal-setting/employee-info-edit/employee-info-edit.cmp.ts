import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../error-dialog/error-dialog.cmp';
import { ZipcodeToAddressService } from '../../zipcode-to-address.service';
import { PersonalSettingDataService } from '../personal-setting-data.service';
import { createEmptyDependentForm } from '../../personal-form-data';
import { DEPENDENT_RELATIONSHIP_LABELS, DependentRelationship } from '../../personal-document';
import { RoutesService } from '../../routes.service';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';
import { CurrentTenantService } from '../../current-tenant.service';

@Component({
  selector: 'app-employee-info-edit',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatIconModule,
    MatDatepickerModule,
    MatDatepickerToggle,
  ],
  templateUrl: './employee-info-edit.cmp.html',
  styleUrls: ['./employee-info-edit.cmp.css', '../personal-setting.cmp.css'],
})
export class EmployeeInfoEditCmp {
  readonly dataService = inject(PersonalSettingDataService);
  readonly currentTenantService = inject(CurrentTenantService);
  private readonly zipcodeToAddressService = inject(ZipcodeToAddressService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  submitBusy = false;

  readonly relationshipOptions = (
    Object.entries(DEPENDENT_RELATIONSHIP_LABELS) as [DependentRelationship, string][]
  ).map(([value, label]) => ({ value, label }));

  get employeeForm() { return this.dataService.employeeForm; }

  get employeeDisplayZipcode(): string {
    const z = this.employeeForm.zipcode;
    return z.length > 3 ? `${z.slice(0, 3)}-${z.slice(3)}` : z;
  }

  set employeeDisplayZipcode(value: string) {
    this.employeeForm.zipcode = value.replace(/[^0-9]/g, '');
  }

  onHasDependentsChange(value: boolean): void {
    this.employeeForm.hasDependents = value;
    if (value && this.employeeForm.dependentsInfo.length === 0) {
      this.employeeForm.dependentsInfo = [createEmptyDependentForm()];
    }
  }

  addDependent(): void {
    this.employeeForm.dependentsInfo = [
      ...this.employeeForm.dependentsInfo,
      createEmptyDependentForm(),
    ];
  }

  removeDependent(index: number): void {
    this.employeeForm.dependentsInfo?.splice(index, 1);
    if (this.employeeForm.dependentsInfo?.length === 0) {
      this.employeeForm.hasDependents = false;
    }
  }
  
  getEmployeeAddress(zipcode: string): void {
    this.zipcodeToAddressService.getAddress(zipcode).then((address) => {
      this.employeeForm.address = { ...this.employeeForm.address, address1: address };
    }).catch((error) => {
      this.dialog.open(ErrorDialogCmp, { data: { message: mapFirebaseError(error) } });
    });
  }

  applyBasicToEmployeeSettings(): void {
    this.dataService.applyPersonalToEmployee();
  }

  async save(): Promise<void> {
    this.submitBusy = true;
    try {
      if (this.currentTenantService.affiliations().length > 1) {
        await this.dataService.saveEmployee();
      } else {
        await this.dataService.saveEmployeeAndPersonal();
      }
      this.routesService.redirectToEmployeeSetting();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, { data: { message: mapFirebaseError(error) } });
    } finally {
      this.submitBusy = false;
    }
  }

  cancel(): void {
    this.routesService.redirectToEmployeeSetting();
  }
}
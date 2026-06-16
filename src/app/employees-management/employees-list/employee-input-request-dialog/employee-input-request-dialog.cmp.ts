import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface EmployeeInputRequestDialogData {
  fieldLabel: string;
  selectedCount: number;
  displayName?: string;
}

@Component({
  selector: 'app-employee-input-request-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './employee-input-request-dialog.cmp.html',
  styleUrl: './employee-input-request-dialog.cmp.css',
})
export class EmployeeInputRequestDialogCmp {
  readonly data = inject<EmployeeInputRequestDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EmployeeInputRequestDialogCmp>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

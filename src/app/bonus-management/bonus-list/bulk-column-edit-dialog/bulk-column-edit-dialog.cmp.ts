import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BulkEditableColumn, BulkEditValue } from '../bonus-bulk-edit.types';

export interface BulkColumnEditDialogData {
  column: BulkEditableColumn;
  displayName?: string;
  employeeId?: string;
  label: string;
  selectedCount: number;
  initialValue: BulkEditValue;
}

@Component({
  selector: 'app-bonus-bulk-column-edit-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './bulk-column-edit-dialog.cmp.html',
  styleUrl: './bulk-column-edit-dialog.cmp.css',
})
export class BulkColumnEditDialogCmp {
  readonly data = inject<BulkColumnEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<BulkColumnEditDialogCmp>);

  numberValue: number | null = null;

  constructor() {
    this.numberValue = this.data.initialValue;
  }

  save(): void {
    const value: BulkEditValue = this.numberValue;
    this.dialogRef.close(value);
  }
}

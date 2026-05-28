import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule, MatDatepickerToggle } from '@angular/material/datepicker';
import { toFormDate } from '../../../date-utils';
import {
  BulkEditableColumn,
  BulkEditValue,
  isDateBulkColumn,
} from '../employees-bulk-edit.types';

export interface BulkColumnEditDialogData {
  column: BulkEditableColumn;
  label: string;
  selectedCount: number;
  initialValue: unknown;
}

@Component({
  selector: 'app-bulk-column-edit-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatDatepickerToggle,
  ],
  templateUrl: './bulk-column-edit-dialog.cmp.html',
  styleUrl: './bulk-column-edit-dialog.cmp.css',
})
export class BulkColumnEditDialogCmp {
  readonly data = inject<BulkColumnEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<BulkColumnEditDialogCmp>);

  stringValue = '';
  dateValue: Date | null = null;

  constructor() {
    if (this.isDateColumn(this.data.column)) {
      this.dateValue = toFormDate(this.data.initialValue);
    } else {
      this.stringValue = this.data.initialValue == null ? '' : String(this.data.initialValue);
    }
  }

  isDateColumn(column: BulkEditableColumn): boolean {
    return isDateBulkColumn(column);
  }

  save(): void {
    const value: BulkEditValue = this.isDateColumn(this.data.column)
      ? this.dateValue
      : this.stringValue;
    this.dialogRef.close(value);
  }
}
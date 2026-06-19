import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface AddEmployeeDialogEntry {
  eid: string;
  employeeId: string;
  displayName: string;
}

export interface ListAddEmployeesDialogData {
  title: string;
  employees: AddEmployeeDialogEntry[];
}

@Component({
  selector: 'app-list-add-employees-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './list-add-employees-dialog.cmp.html',
  styleUrl: './list-add-employees-dialog.cmp.css',
})
export class ListAddEmployeesDialogCmp {
  readonly data = inject<ListAddEmployeesDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ListAddEmployeesDialogCmp, string[] | undefined>);

  readonly selectedEids = new Set<string>();

  isSelected(eid: string): boolean {
    return this.selectedEids.has(eid);
  }

  toggleSelection(eid: string, checked: boolean): void {
    if (checked) {
      this.selectedEids.add(eid);
    } else {
      this.selectedEids.delete(eid);
    }
  }

  isAllSelected(): boolean {
    return (
      this.data.employees.length > 0 &&
      this.data.employees.every((employee) => this.selectedEids.has(employee.eid))
    );
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.data.employees.forEach((employee) => this.selectedEids.add(employee.eid));
    } else {
      this.selectedEids.clear();
    }
  }

  add(): void {
    this.dialogRef.close([...this.selectedEids]);
  }
}

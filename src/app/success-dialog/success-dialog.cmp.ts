import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './success-dialog.cmp.html',
  styleUrl: './success-dialog.cmp.css',
})
export class SuccessDialogCmp {
  readonly data = inject<{ message: string }>(MAT_DIALOG_DATA);
}

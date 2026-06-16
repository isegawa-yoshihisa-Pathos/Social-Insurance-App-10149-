import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
  RetroactivePayReviewItem,
  RetroactiveRemunerationProposedGrades,
  RetroactiveWageKind,
} from '../../../../../shared/retroactive-remuneration-review-document';
import {
  normalizeRetroactiveReviewItems,
  validateRetroactiveReviewItems,
} from '../../../../../shared/social-insurance/remuneration/retroactive-remuneration';
import { FunctionsService } from '../../../functions.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { MatDialog } from '@angular/material/dialog';
import type { RetroactiveRemunerationReviewItem } from '../../retroactive-remuneration-data.service';
import { Format } from '../../../format-number-jp';

export interface RetroactiveAllocateDialogData {
  tid: string;
  review: RetroactiveRemunerationReviewItem;
}

export interface RetroactiveAllocateDialogResult {
  applied: boolean;
}

@Component({
  selector: 'app-retroactive-remuneration-allocate-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './retroactive-remuneration-allocate-dialog.cmp.html',
  styleUrl: './retroactive-remuneration-allocate-dialog.cmp.css',
})
export class RetroactiveRemunerationAllocateDialogCmp {
  private readonly dialogRef = inject(MatDialogRef<RetroactiveRemunerationAllocateDialogCmp>);
  private readonly data = inject<RetroactiveAllocateDialogData>(MAT_DIALOG_DATA);
  private readonly functionsService = inject(FunctionsService);
  private readonly dialog = inject(MatDialog);
  readonly Format = Format;

  readonly review = this.data.review;
  readonly monthOptions = [...this.review.calculationMonthKeys];
  items: RetroactivePayReviewItem[] = normalizeRetroactiveReviewItems(
    structuredClone(this.review.items),
  );

  busy = false;
  validationError: string | null = null;
  previewGrades: RetroactiveRemunerationProposedGrades | null = null;

  close(): void {
    this.dialogRef.close({ applied: false } satisfies RetroactiveAllocateDialogResult);
  }

  allocationSum(item: RetroactivePayReviewItem): number {
    return item.allocations.reduce((s, line) => s + (line.amount ?? 0), 0);
  }

  isOverAllocated(item: RetroactivePayReviewItem): boolean {
    return this.allocationSum(item) > item.amount;
  }

  isPartiallyAllocated(item: RetroactivePayReviewItem): boolean {
    const sum = this.allocationSum(item);
    return sum > 0 && sum < item.amount;
  }

  addAllocationLine(item: RetroactivePayReviewItem): void {
    const defaultMonth = item.paymentYyyyMm;
    item.allocations.push({ targetYyyyMm: defaultMonth, amount: 0, wageKind: 'fixed' });
  }

  removeAllocationLine(item: RetroactivePayReviewItem, index: number): void {
    if (item.allocations.length <= 1) return;
    item.allocations.splice(index, 1);
  }

  wageKindLabel(kind: RetroactiveWageKind): string {
    return kind === 'fixed' ? '固定的賃金' : '非固定的賃金';
  }

  private validate(): boolean {
    this.validationError = validateRetroactiveReviewItems(this.items);
    return !this.validationError;
  }

  async preview(): Promise<void> {
    if (!this.validate()) return;

    this.busy = true;
    this.previewGrades = null;
    try {
      const result = await this.functionsService.previewRetroactiveRemunerationRecalc({
        tid: this.data.tid,
        reviewId: this.review.id,
        items: this.items,
      });
      this.previewGrades = result.proposedGrades;
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busy = false;
    }
  }

  async apply(): Promise<void> {
    if (!this.validate()) return;

    this.busy = true;
    try {
      await this.functionsService.applyRetroactiveRemunerationRecalc({
        tid: this.data.tid,
        reviewId: this.review.id,
        items: this.items,
      });
      this.dialogRef.close({ applied: true } satisfies RetroactiveAllocateDialogResult);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.busy = false;
    }
  }
}

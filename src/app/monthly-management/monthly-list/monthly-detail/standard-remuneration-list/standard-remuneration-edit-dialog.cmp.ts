import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { YEAR_OPTIONS, MONTH_OPTIONS } from '../../../../datePicker';
import { StandardRemunerationSource } from '../../../../social-insurance/monthly/social-insurance-document';
import { EDITABLE_STANDARD_REMUNERATION_SOURCE_OPTIONS } from '../standard-remuneration-display.util';
import {
  parseYyyyMm,
  toYyyyMm,
  tryResolveManualGrades,
} from '../standard-remuneration-manual.util';

export interface StandardRemunerationEditDialogData {
  mode: 'add' | 'edit';
  initial?: {
    effectiveFrom: string;
    source: StandardRemunerationSource;
    standardRemunerationHealth: number;
    standardRemunerationPension: number;
    remuneration: number | null;
  };
}

export interface StandardRemunerationEditDialogResult {
  effectiveFrom: string;
  source: StandardRemunerationSource;
  standardRemunerationHealth: number;
  standardRemunerationPension: number;
  remuneration: number | null;
}

@Component({
  selector: 'app-standard-remuneration-edit-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './standard-remuneration-edit-dialog.cmp.html',
  styleUrl: './standard-remuneration-edit-dialog.cmp.css',
})
export class StandardRemunerationEditDialogCmp {
  readonly data = inject<StandardRemunerationEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<StandardRemunerationEditDialogCmp>);

  readonly yearOptions = YEAR_OPTIONS;
  readonly monthOptions = MONTH_OPTIONS;
  readonly sourceOptions = EDITABLE_STANDARD_REMUNERATION_SOURCE_OPTIONS;

  readonly selectedYear = signal(this.parseInitialYear());
  readonly selectedMonth = signal(this.parseInitialMonth());
  selectedSource: StandardRemunerationSource;
  standardRemunerationHealth: number | null;
  standardRemunerationPension: number | null;
  remuneration: number | null;
  validationError = '';

  readonly resolvedGrades = computed(() => {
    const health = this.standardRemunerationHealth;
    const pension = this.standardRemunerationPension;
    if (health == null || pension == null) {
      return null;
    }
    return tryResolveManualGrades(health, pension);
  });

  constructor() {
    this.selectedSource = this.resolveInitialSource();
    this.standardRemunerationHealth = this.data.initial?.standardRemunerationHealth ?? null;
    this.standardRemunerationPension = this.data.initial?.standardRemunerationPension ?? null;
    this.remuneration = this.data.initial?.remuneration ?? null;
  }

  get title(): string {
    return this.data.mode === 'add' ? '標準報酬月額を追加' : '標準報酬月額を編集';
  }

  save(): void {
    this.validationError = '';

    const health = this.standardRemunerationHealth;
    const pension = this.standardRemunerationPension;
    if (health == null || pension == null) {
      this.validationError = '標準報酬月額（健保・厚年）を入力してください。';
      return;
    }

    const grades = tryResolveManualGrades(health, pension);
    if (!grades) {
      this.validationError = '等級表に該当しない標準報酬月額です。';
      return;
    }

    const effectiveFrom = toYyyyMm(this.selectedYear(), this.selectedMonth());
    this.dialogRef.close({
      effectiveFrom,
      source: this.selectedSource,
      standardRemunerationHealth: health,
      standardRemunerationPension: pension,
      remuneration: this.remuneration,
    } satisfies StandardRemunerationEditDialogResult);
  }

  private resolveInitialSource(): StandardRemunerationSource {
    const initial = this.data.initial?.source;
    if (
      initial &&
      this.sourceOptions.some((option) => option.value === initial)
    ) {
      return initial;
    }
    return 'manual';
  }

  private parseInitialYear(): number {
    const parsed = parseYyyyMm(this.data.initial?.effectiveFrom ?? '');
    return parsed?.year ?? new Date().getFullYear();
  }

  private parseInitialMonth(): number {
    const parsed = parseYyyyMm(this.data.initial?.effectiveFrom ?? '');
    return parsed?.month ?? new Date().getMonth() + 1;
  }
}

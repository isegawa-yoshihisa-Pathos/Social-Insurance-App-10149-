import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { BONUS_TYPE_LABELS, BonusMap } from '../../../monthly-document';
import { buildBonusDisplayParts } from '../bonus-display.util';

export interface BonusDetailDialogData {
  displayName: string;
  yyyyMm: string;
  bonus: BonusMap;
}

@Component({
  selector: 'app-bonus-detail-dialog',
  standalone: true,
  imports: [DecimalPipe, MatDialogModule, MatButtonModule],
  templateUrl: './bonus-detail-dialog.cmp.html',
  styleUrl: './bonus-detail-dialog.cmp.css',
})
export class BonusDetailDialogCmp {
  readonly data = inject<BonusDetailDialogData>(MAT_DIALOG_DATA);

  private readonly parts = buildBonusDisplayParts(this.data.bonus);
  readonly entries = this.parts.entries;
  readonly total = this.parts.total;
  readonly bonusTypeLabels = BONUS_TYPE_LABELS;
}

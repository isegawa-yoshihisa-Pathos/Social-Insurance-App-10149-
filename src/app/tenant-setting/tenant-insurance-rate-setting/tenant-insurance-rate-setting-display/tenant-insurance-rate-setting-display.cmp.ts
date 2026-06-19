import { Component, EventEmitter, Output, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TenantInsuranceRateSettingDataService } from '../tenant-insurance-rate-setting-data.service';
import { formatJapaneseDate } from '../../../date-utils';
import {
  normalizeRoundingBoundaryType,
  ROUNDING_BOUNDARY_LABELS,
  type RoundingBoundaryType,
} from '../../../social-insurance/monthly/social-insurance-document';
import type { InsuranceRateListItem } from '../../../social-insurance/monthly/insurance-rate-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';

@Component({
  selector: 'app-tenant-insurance-rate-setting-display',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatTableModule, MatIconModule, MatTooltipModule],
  templateUrl: './tenant-insurance-rate-setting-display.cmp.html',
  styleUrl: './tenant-insurance-rate-setting-display.cmp.css'
})
export class TenantInsuranceRateSettingDisplayCmp implements OnInit {
  readonly dataService = inject(TenantInsuranceRateSettingDataService);
  private readonly dialog = inject(MatDialog);

  @Output() readonly addRate = new EventEmitter<void>();

  deleteBusy = false;

  readonly displayedColumns: string[] = [
    'effectiveFrom',
    'label',
    'rates',
    'rounding',
    'rateSource',
    'deleteButton'
  ];

  private readonly sourceLabelMap: Record<string, string> = {
    association_table: '協会けんぽ（マスタ）',
    combination_import: '組合健保（マスタ）',
    combination_manual: '組合健保（手修正）',
    manual: '手入力'
  };

  readonly currentRate = computed(() => {
    const list = this.dataService.rates();
    if (list.length === 0) return null;

    const todayStr = this.getTodayYyyyMmDd();
    const activeRates = list
      .filter((r) => r.doc.effectiveFrom <= todayStr)
      .sort((a, b) => b.doc.effectiveFrom.localeCompare(a.doc.effectiveFrom));

    return activeRates[0] || null;
  });

  async ngOnInit(): Promise<void> {
    await this.dataService.loadRates();
  }

  getRateSourceLabel(source: string): string {
    return this.sourceLabelMap[source] || source || '未設定';
  }

  formatRatePercent(rate: number): string {
    if (rate == null) return '0.00%';
    // 浮動小数点誤差を考慮して丸め処理を入れるとより安全です
    return `${(rate * 100).toFixed(2)}%`;
  }

  formatRounding(sen: number | undefined, boundaryType?: RoundingBoundaryType): string {
    const amount = sen ?? 50;
    const boundary = ROUNDING_BOUNDARY_LABELS[
      normalizeRoundingBoundaryType(boundaryType)
    ];
    return `${amount}銭${boundary}`;
  }

  formatRoundingSummary(
    roundingBy: { healthInsurance?: number; careInsurance?: number; pensionInsurance?: number },
    boundaryType?: RoundingBoundaryType,
  ): string {
    const boundary = ROUNDING_BOUNDARY_LABELS[
      normalizeRoundingBoundaryType(boundaryType)
    ];
    return `健${roundingBy.healthInsurance ?? 50}/介${roundingBy.careInsurance ?? 50}/厚${roundingBy.pensionInsurance ?? 50}（${boundary}）`;
  }

  private getTodayYyyyMmDd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatEffectiveFrom(yyyyMmDd: string): string {
    if (!yyyyMmDd) {
      return '';
    }
    const [year, month, day] = yyyyMmDd.split('-').map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return yyyyMmDd;
    }
    return formatJapaneseDate(new Date(year, month - 1, day));
  }

  canDeleteRate(row: InsuranceRateListItem): boolean {
    if (this.deleteBusy) {
      return false;
    }
    if (this.dataService.rates().length <= 1) {
      return false;
    }
    const current = this.currentRate();
    return current?.rateId !== row.rateId;
  }

  deleteTooltip(row: InsuranceRateListItem): string {
    if (this.dataService.rates().length <= 1) {
      return '最後の1件は削除できません';
    }
    const current = this.currentRate();
    if (current?.rateId === row.rateId) {
      return '現在有効な料率は削除できません';
    }
    return '削除';
  }

  async deleteRate(row: InsuranceRateListItem): Promise<void> {
    if (!this.canDeleteRate(row)) {
      return;
    }

    const confirmed = confirm(
      `${this.formatEffectiveFrom(row.doc.effectiveFrom)}（${row.doc.label || 'ラベル未設定'}）の料率を削除しますか？\nこの操作は取り消せません。`,
    );
    if (!confirmed) {
      return;
    }

    this.deleteBusy = true;
    try {
      await this.dataService.deleteRate(row.rateId);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.deleteBusy = false;
    }
  }
}
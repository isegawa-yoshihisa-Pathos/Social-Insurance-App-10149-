import { Component, EventEmitter, Output, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { TenantInsuranceRateSettingDataService } from '../tenant-insurance-rate-setting-data.service';
import { formatJapaneseDate } from '../../../date-utils';

@Component({
  selector: 'app-tenant-insurance-rate-setting-display',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatTableModule],
  templateUrl: './tenant-insurance-rate-setting-display.cmp.html',
  styleUrl: './tenant-insurance-rate-setting-display.cmp.css'
})
export class TenantInsuranceRateSettingDisplayCmp implements OnInit {
  readonly dataService = inject(TenantInsuranceRateSettingDataService);

  @Output() readonly addRate = new EventEmitter<void>();

  readonly displayedColumns: string[] = [
    'effectiveFrom',
    'label',
    'rates',
    'rounding',
    'rateSource'
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
}
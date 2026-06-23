import { Component, effect, inject, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, firstValueFrom } from 'rxjs';
import { CurrentTenantService } from '../../../../current-tenant.service';
import { StandardRemunerationDataService } from '../../../../social-insurance/monthly/standard-remuneration-data.service';
import { RemunerationConsentDataService } from '../../../../task-board/remuneration-consent-data.service';
import { RetroactiveRemunerationDataService } from '../../../../task-board/retroactive-remuneration-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../../error-dialog/error-dialog.cmp';
import { SuccessDialogCmp } from '../../../../success-dialog/success-dialog.cmp';
import {
  formatCurrency,
  formatFirestoreTimestamp,
  formatYyyyMmLabel,
  inferCalculationYyyyMm,
  resolveDeterminationLabel,
} from '../standard-remuneration-display.util';
import { buildStandardRemunerationPayload } from '../standard-remuneration-manual.util';
import { StandardRemunerationSource } from '../../../../social-insurance/monthly/social-insurance-document';
import {
  StandardRemunerationEditDialogCmp,
  StandardRemunerationEditDialogResult,
} from './standard-remuneration-edit-dialog.cmp';

export interface StandardRemunerationHistoryRow {
  recordId: string;
  effectiveFrom: string;
  source: StandardRemunerationSource;
  calculationYyyyMm: string;
  determinationLabel: string;
  healthGrade: number;
  pensionGrade: number;
  standardRemunerationHealth: number;
  standardRemunerationPension: number;
  remuneration: number | null;
  recordedAt: string;
  sortKey: string;
}

@Component({
  selector: 'app-standard-remuneration-list',
  imports: [MatTableModule, MatSortModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './standard-remuneration-list.cmp.html',
  styleUrl: './standard-remuneration-list.cmp.css',
})
export class StandardRemunerationListCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly standardRemunerationDataService = inject(StandardRemunerationDataService);
  private readonly consentDataService = inject(RemunerationConsentDataService);
  private readonly retroactiveDataService = inject(RetroactiveRemunerationDataService);
  private readonly dialog = inject(MatDialog);

  private loadToken = 0;
  saving = false;

  readonly eid = toSignal(
    this.route.parent?.paramMap.pipe(map((params) => params.get('eid'))) ??
      this.route.paramMap.pipe(map((params) => params.get('eid'))),
    { initialValue: null },
  );

  readonly loading = signal(true);
  readonly displayedColumns = [
    'calculationYyyyMm',
    'determinationLabel',
    'effectiveFrom',
    'healthGrade',
    'pensionGrade',
    'standardRemunerationHealth',
    'standardRemunerationPension',
    'remuneration',
    'recordedAt',
    'actions',
  ] as const;

  dataSource = new MatTableDataSource<StandardRemunerationHistoryRow>([]);

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (row, property) => {
      switch (property) {
        case 'calculationYyyyMm':
          return row.calculationYyyyMm;
        case 'effectiveFrom':
          return row.effectiveFrom;
        case 'determinationLabel':
          return row.determinationLabel;
        case 'healthGrade':
          return row.healthGrade;
        case 'pensionGrade':
          return row.pensionGrade;
        case 'standardRemunerationHealth':
          return row.standardRemunerationHealth;
        case 'standardRemunerationPension':
          return row.standardRemunerationPension;
        case 'remuneration':
          return row.remuneration ?? -1;
        case 'recordedAt':
          return row.sortKey;
        default:
          return '';
      }
    };

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.dataSource.data = [];
        this.loading.set(false);
        return;
      }

      const token = ++this.loadToken;
      void this.loadHistory(tid, eid, token);
    });
  }

  openAddDialog(): void {
    void this.openEditDialog('add');
  }

  openEditDialogForRow(row: StandardRemunerationHistoryRow): void {
    void this.openEditDialog('edit', row);
  }

  async deleteRow(row: StandardRemunerationHistoryRow): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid || this.saving) {
      return;
    }

    const confirmed = window.confirm(
      `${formatYyyyMmLabel(row.effectiveFrom)} の標準報酬月額（${row.determinationLabel}）を削除しますか？\nこの操作は取り消せません。`,
    );
    if (!confirmed) {
      return;
    }

    this.saving = true;
    try {
      await this.standardRemunerationDataService.delete(tid, eid, row.recordId);
      this.dialog.open(SuccessDialogCmp, {
        data: { message: '標準報酬月額を削除しました。' },
      });
      await this.reloadCurrentEmployee();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.saving = false;
    }
  }

  private async openEditDialog(
    mode: 'add' | 'edit',
    row?: StandardRemunerationHistoryRow,
  ): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid || this.saving) {
      return;
    }

    const dialogRef = this.dialog.open(StandardRemunerationEditDialogCmp, {
      data: {
        mode,
        initial: row
          ? {
              effectiveFrom: row.effectiveFrom,
              source: row.source,
              standardRemunerationHealth: row.standardRemunerationHealth,
              standardRemunerationPension: row.standardRemunerationPension,
              remuneration: row.remuneration,
            }
          : undefined,
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed()) as StandardRemunerationEditDialogResult | undefined;
    if (!result) {
      return;
    }

    this.saving = true;
    try {
      const payload = buildStandardRemunerationPayload(result);
      if (mode === 'edit' && row && row.recordId !== result.effectiveFrom) {
        await this.standardRemunerationDataService.delete(tid, eid, row.recordId);
      }
      await this.standardRemunerationDataService.save(tid, eid, result.effectiveFrom, payload);
      this.dialog.open(SuccessDialogCmp, {
        data: { message: mode === 'add' ? '標準報酬月額を追加しました。' : '標準報酬月額を更新しました。' },
      });
      await this.reloadCurrentEmployee();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      this.saving = false;
    }
  }

  private async reloadCurrentEmployee(): Promise<void> {
    const tid = this.currentTenantService.currentTid();
    const eid = this.eid();
    if (!tid || !eid) {
      return;
    }
    const token = ++this.loadToken;
    await this.loadHistory(tid, eid, token);
  }

  private async loadHistory(tid: string, eid: string, token: number): Promise<void> {
    this.loading.set(true);
    try {
      const [history, consentReviews, retroactiveReviews] = await Promise.all([
        this.standardRemunerationDataService.listForEmployee(tid, eid),
        this.consentDataService.listEmployeeConsents(tid, eid),
        this.retroactiveDataService.listEmployeeReviews(tid, eid),
      ]);
      if (token !== this.loadToken) return;

      this.dataSource.data = history.map((item) => {
        const { doc } = item;
        const effectiveFrom = doc.effectiveFrom || item.yyyyMm;
        const calculationYyyyMm =
          inferCalculationYyyyMm(doc.source, effectiveFrom) ?? effectiveFrom;

        return {
          recordId: item.yyyyMm,
          effectiveFrom,
          source: doc.source,
          calculationYyyyMm,
          determinationLabel: resolveDeterminationLabel(
            effectiveFrom,
            doc.source,
            doc.healthGrade,
            doc.pensionGrade,
            consentReviews,
            retroactiveReviews,
          ),
          healthGrade: doc.healthGrade,
          pensionGrade: doc.pensionGrade,
          standardRemunerationHealth: doc.standardRemuneration.health,
          standardRemunerationPension: doc.standardRemuneration.pension,
          remuneration: doc.remuneration ?? null,
          recordedAt: formatFirestoreTimestamp(doc.updatedAt),
          sortKey: effectiveFrom,
        };
      });
    } catch (error) {
      if (token !== this.loadToken) return;
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  formatYyyyMm = formatYyyyMmLabel;
  formatCurrency = formatCurrency;
}


import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  doc,
  serverTimestamp,
  writeBatch,
  deleteField,
} from '@angular/fire/firestore';
import { buildBonusData, sumBonusAmounts } from './bonus-data.util';
import { bonusTypeFromColumnKey } from './bonus-display.util';
import { BulkEditableColumn, BulkEditTarget, BulkEditValue } from './bonus-bulk-edit.types';
import { BonusAmountMap } from '../../bonus-document';
import { BonusListDataService } from './bonus-list-data.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  BulkEditableStandardBonusColumnKey,
  isBulkEditablePremiumAmountColumn,
  isBulkEditableStandardBonusColumn,
} from '../bonus-premium/bonus-premium-columns';
import {
  applyPremiumAmountColumn,
  premiumDataFromRow,
  type PremiumAmountColumnKey,
} from '../../../../shared/social-insurance/premium/premium-manual-edit.util';
import {
  StandardBonusDataService,
  type StandardBonusSavePayload,
} from '../../social-insurance/bonus/standard-bonus-data.service';
import type { StandardBonusDocument } from '../../social-insurance/bonus/social-insurance-document';
import { getBonusListColumnLabel } from './bonus-list-columns';

@Injectable({
  providedIn: 'root',
})
export class BonusListBulkEditService {
  private readonly firestore = inject(Firestore);
  private readonly listDataService = inject(BonusListDataService);
  private readonly standardBonusDataService = inject(StandardBonusDataService);
  private readonly auditLog = inject(AuditLogService);

  async applyBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): Promise<void> {
    if (targets.length === 0) return;

    if (await this.listDataService.isPeriodLocked(tid, yyyyMm)) {
      throw new Error('この月は締切済みのため、編集できません。');
    }

    if (isBulkEditableStandardBonusColumn(column)) {
      await this.applyStandardBonusBulkEdit(tid, yyyyMm, targets, column, value);
      return;
    }

    if (isBulkEditablePremiumAmountColumn(column)) {
      await this.applyPremiumBulkEdit(tid, yyyyMm, targets, column as PremiumAmountColumnKey, value);
      return;
    }

    const bonusType = bonusTypeFromColumnKey(column);
    const batch = writeBatch(this.firestore);

    for (const { eid, bonus } of targets) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'bonus-records',
        yyyyMm,
        'employees',
        eid,
      );
      const payload = bonusType
        ? this.buildBonusUpdatePayload(bonus, bonusType, value)
        : this.buildUpdatePayload(column, value);
      batch.update(employeeRef, payload);
    }

    this.listDataService.touchPeriodInBatch(batch, tid, yyyyMm);

    await batch.commit();

    await this.auditLog.recordUpdate({
      tid,
      category: 'bonus.bulk_edit',
      summary: '賞与一括編集を適用',
      target: this.auditLog.bonusTarget(yyyyMm),
      metadata: {
        column,
        targetCount: targets.length,
        value,
      },
    });
  }

  private async applyStandardBonusBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: BulkEditableStandardBonusColumnKey,
    value: BulkEditValue,
  ): Promise<void> {
    if (value == null) {
      throw new Error('標準賞与額は数値で入力してください。');
    }

    const columnLabel = getBonusListColumnLabel(column, []);

    await Promise.all(
      targets.map(async (target) => {
        const existing = await this.standardBonusDataService.get(tid, target.eid, yyyyMm);
        const payload = this.buildManualStandardBonus(
          existing,
          column,
          value,
          yyyyMm,
          sumBonusAmounts(target.bonus),
        );
        await this.standardBonusDataService.save(tid, target.eid, yyyyMm, payload);

        await this.auditLog.recordUpdate({
          tid,
          category: 'bonus.standardBonus',
          summary: `${yyyyMm} の標準賞与額を一括更新（${columnLabel}）`,
          target: {
            kind: 'bonus',
            eid: target.eid,
            resourceId: yyyyMm,
            label: columnLabel,
          },
          before: {
            [column]: existing?.standardBonus?.[
              column === 'standardBonusHealth' ? 'health' : 'pension'
            ] ?? null,
          },
          after: { [column]: value },
          metadata: { column, yyyyMm },
        });
      }),
    );
  }

  private async applyPremiumBulkEdit(
    tid: string,
    yyyyMm: string,
    targets: BulkEditTarget[],
    column: PremiumAmountColumnKey,
    value: BulkEditValue,
  ): Promise<void> {
    if (value == null) {
      throw new Error('保険料は数値で入力してください。');
    }

    const batch = writeBatch(this.firestore);
    const columnLabel = getBonusListColumnLabel(column, []);

    for (const target of targets) {
      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'bonus-records',
        yyyyMm,
        'employees',
        target.eid,
      );
      const premiumData = applyPremiumAmountColumn(
        premiumDataFromRow(target),
        column,
        value,
      );
      batch.update(employeeRef, {
        premiumData,
        updatedAt: serverTimestamp(),
      });
    }

    this.listDataService.touchPeriodInBatch(batch, tid, yyyyMm);
    await batch.commit();

    for (const target of targets) {
      await this.auditLog.recordUpdate({
        tid,
        category: 'bonus.premium',
        summary: `${yyyyMm} の賞与保険料を一括更新（${columnLabel}）`,
        target: {
          kind: 'bonus',
          eid: target.eid,
          resourceId: yyyyMm,
          label: columnLabel,
        },
        before: { [column]: target[column] },
        after: { [column]: value },
        metadata: { column, yyyyMm },
      });
    }
  }

  private buildManualStandardBonus(
    existing: StandardBonusDocument | null,
    column: BulkEditableStandardBonusColumnKey,
    value: number,
    yyyyMm: string,
    bonusAmount: number,
  ): StandardBonusSavePayload {
    const existingHealth = existing?.standardBonus.health ?? 0;
    const existingPension = existing?.standardBonus.pension ?? 0;
    const health =
      column === 'standardBonusHealth' ? value : existingHealth;
    const pension =
      column === 'standardBonusPension' ? value : existingPension;

    return {
      standardBonus: { health, pension },
      source: 'manual',
      effectiveFrom: yyyyMm,
      bonusAmount: existing?.bonusAmount ?? bonusAmount,
      rawStandardBonus: Math.max(health, pension),
      skipReason: existing?.skipReason,
    };
  }

  private buildBonusUpdatePayload(
    existing: BonusAmountMap,
    bonusType: string,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    const amounts = { ...existing };
    if (value == null || value === 0) {
      delete amounts[bonusType];
    } else {
      amounts[bonusType] = value;
    }

    const bonusData = buildBonusData(amounts);
    return bonusData === undefined
      ? { bonusData: deleteField(), updatedAt: serverTimestamp() }
      : { bonusData, updatedAt: serverTimestamp() };
  }

  private buildUpdatePayload(
    column: BulkEditableColumn,
    value: BulkEditValue,
  ): UpdateData<DocumentData> {
    return { updatedAt: serverTimestamp() };
  }
}

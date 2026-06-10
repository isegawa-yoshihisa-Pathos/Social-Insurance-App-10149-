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
import { buildBonusData } from './bonus-data.util';
import { bonusTypeFromColumnKey } from './bonus-display.util';
import { BulkEditableColumn, BulkEditTarget, BulkEditValue } from './bonus-bulk-edit.types';
import { BonusAmountMap } from '../../bonus-document';
import { BonusListDataService } from './bonus-list-data.service';

@Injectable({
  providedIn: 'root',
})
export class BonusListBulkEditService {
  private readonly firestore = inject(Firestore);
  private readonly listDataService = inject(BonusListDataService);

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

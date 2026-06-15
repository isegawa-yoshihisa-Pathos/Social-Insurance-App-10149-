import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  deleteField,
  doc,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { BonusAmountMap, BonusData, BonusTypeDefinition } from '../../bonus-document';
import { BonusManagementDataService } from '../bonus-management-data.service';
import { BonusSettingDataService } from '../bonus-setting/bonus-setting-data.service';
import {
  BonusImportColumnDef,
  buildBonusImportColumnDefs,
} from '../bonus-setting/bonus-import-columns';
import { buildBonusData } from './bonus-data.util';
import { BonusListRow } from './bonus-list-columns';
import { BonusListDataService, EmployeeLookupEntry } from './bonus-list-data.service';
import { resolveCsvImportLayout } from '../../csv/csv-file.util';

export interface BonusCsvImportOptions {
  yyyyMm: string;
  allRows?: BonusListRow[];
  scopeEids?: Set<string>;
}

export interface BonusCsvImportResult {
  updated: number;
  created: number;
  skippedNoMatch: number;
  skippedOutOfScope: number;
  skippedAmbiguous: number;
  skippedEmpty: number;
}

interface BonusImportPatch {
  bonusAmounts?: BonusAmountMap;
  payrollFields?: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class BonusListImportService {
  private readonly firestore = inject(Firestore);
  private readonly bonusSettingDataService = inject(BonusSettingDataService);
  private readonly bonusManagementDataService = inject(BonusManagementDataService);
  private readonly listDataService = inject(BonusListDataService);

  async importFromCsv(
    tid: string,
    file: File,
    options: BonusCsvImportOptions,
  ): Promise<BonusCsvImportResult> {
    const csvText = await file.text();
    const rows = this.parseCsvRows(csvText);
    const layout = resolveCsvImportLayout(rows);
    if (rows.length < layout.dataStartIndex + 1) {
      throw new Error('CSVにデータ行がありません。');
    }
    const targetYyyyMm = layout.yyyyMmFromFile ?? options.yyyyMm;

    if (await this.listDataService.isPeriodLocked(tid, targetYyyyMm)) {
      throw new Error(`${targetYyyyMm} は締切済みのため、インポートできません。`);
    }

    await this.bonusManagementDataService.loadBonusSettings(tid);
    const bonusDefinitions = this.bonusManagementDataService.bonusTypeDefinitions();
    await this.bonusSettingDataService.loadSettings(tid, bonusDefinitions);

    const columnDefs = buildBonusImportColumnDefs(bonusDefinitions);
    const headers = rows[layout.headerRowIndex].map((h) => h.trim());
    const headerIndex = this.buildHeaderIndexMap(headers, columnDefs);

    const employeeIdIdx = headerIndex['employeeId'] ?? -1;
    const displayNameIdx = headerIndex['displayName'] ?? -1;
    if (employeeIdIdx === -1 && displayNameIdx === -1) {
      throw new Error('CSVに社員番号または氏名の列がありません。');
    }

    const allRows = options.allRows ?? [];
    const scopeEids = options.scopeEids;

    const employeeLookup = await this.listDataService.loadEmployeeLookup(tid);
    const { eidByEmployeeId, eidsByDisplayName } =
      this.listDataService.buildMatchMaps(employeeLookup);

    const batch = writeBatch(this.firestore);
    const result: BonusCsvImportResult = {
      updated: 0,
      created: 0,
      skippedNoMatch: 0,
      skippedOutOfScope: 0,
      skippedAmbiguous: 0,
      skippedEmpty: 0,
    };

    for (let i = layout.dataStartIndex; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.every((c) => !c.trim())) continue;

      const employeeId = employeeIdIdx >= 0 ? (cols[employeeIdIdx] ?? '').trim() : '';
      const displayName = displayNameIdx >= 0 ? (cols[displayNameIdx] ?? '').trim() : '';

      const matched = this.resolveEid(
        employeeId,
        displayName,
        eidByEmployeeId,
        eidsByDisplayName,
      );

      if (matched === 'ambiguous') {
        result.skippedAmbiguous++;
        continue;
      }
      if (!matched) {
        result.skippedNoMatch++;
        continue;
      }

      const existingRow = allRows.find((r) => r.eid === matched);
      if (scopeEids && existingRow && !scopeEids.has(matched)) {
        result.skippedOutOfScope++;
        continue;
      }

      const importPatch = this.extractBonusPatch(
        cols,
        headerIndex,
        columnDefs,
        bonusDefinitions,
        existingRow?.bonus ?? {},
      );
      if (!importPatch) {
        result.skippedEmpty++;
        continue;
      }

      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'bonus-records',
        targetYyyyMm,
        'employees',
        matched,
      );

      if (existingRow) {
        batch.update(employeeRef, this.buildBonusUpdatePayload(importPatch));
        result.updated++;
      } else {
        const employee = employeeLookup.get(matched);
        if (!employee) {
          result.skippedNoMatch++;
          continue;
        }
        batch.set(employeeRef, this.buildBonusDocument(employee, importPatch));
        result.created++;
      }
    }

    this.listDataService.touchPeriodInBatch(batch, tid, targetYyyyMm);

    await batch.commit();
    return result;
  }

  private parseCsvRows(text: string): string[][] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((c) => c.trim()));
  }

  private buildHeaderIndexMap(
    headers: string[],
    columnDefs: BonusImportColumnDef[],
  ): Record<string, number> {
    const map: Record<string, number> = {};
    const config = this.bonusSettingDataService.importHeaders();

    for (const col of columnDefs) {
      const headerName = (config[col.key] ?? col.defaultHeader).trim();
      map[col.key] = headers.findIndex((h) => h === headerName);
    }

    return map;
  }

  private resolveEid(
    employeeId: string,
    displayName: string,
    eidByEmployeeId: Map<string, string>,
    eidsByDisplayName: Map<string, string[]>,
  ): string | 'ambiguous' | null {
    if (employeeId) {
      const byId = eidByEmployeeId.get(employeeId.toLowerCase());
      if (byId) return byId;
    }

    if (!displayName) return null;

    const matched = eidsByDisplayName.get(displayName.toLowerCase()) ?? [];
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) return 'ambiguous';
    return null;
  }

  private extractBonusPatch(
    cols: string[],
    idx: Record<string, number>,
    columnDefs: BonusImportColumnDef[],
    bonusDefinitions: BonusTypeDefinition[],
    existingBonus: BonusAmountMap,
  ): BonusImportPatch | null {
    const bonusTypes = new Set(bonusDefinitions.map((d) => d.type));
    const patch: BonusImportPatch = {};
    let hasUpdate = false;

    for (const col of columnDefs) {
      if (col.key === 'displayName' || col.key === 'employeeId') {
        continue;
      }

      const i = idx[col.key];
      if (i === undefined || i < 0) continue;
      const raw = (cols[i] ?? '').trim();
      if (!raw) continue;
      const num = this.parseNumber(raw);
      if (num === null) continue;

      if (bonusTypes.has(col.key)) {
        const bonusAmounts = { ...(patch.bonusAmounts ?? existingBonus) };
        if (num === 0) {
          delete bonusAmounts[col.key];
        } else {
          bonusAmounts[col.key] = num;
        }
        patch.bonusAmounts = bonusAmounts;
        hasUpdate = true;
      } else if (col.kind === 'number') {
        const payrollFields = { ...(patch.payrollFields ?? {}) };
        payrollFields[col.key] = num;
        patch.payrollFields = payrollFields;
        hasUpdate = true;
      }
    }

    return hasUpdate ? patch : null;
  }

  private buildBonusUpdatePayload(
    importPatch: BonusImportPatch,
  ): UpdateData<DocumentData> {
    const update: Record<string, unknown> = {};

    if (importPatch.payrollFields) {
      for (const [key, num] of Object.entries(importPatch.payrollFields)) {
        update[`payrollData.${key}`] = num;
      }
    }

    if (importPatch.bonusAmounts) {
      const bonusData = buildBonusData(importPatch.bonusAmounts);
      if (bonusData === undefined) {
        update['bonusData'] = deleteField();
      } else {
        update['bonusData'] = bonusData;
      }
    }

    update['updatedAt'] = serverTimestamp();
    return update as UpdateData<DocumentData>;
  }

  private buildBonusDocument(
    employee: EmployeeLookupEntry,
    importPatch: BonusImportPatch,
  ): {
    uid: string;
    displayName: string;
    bonusData?: BonusData;
    payrollData?: Record<string, number>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    const doc: {
      uid: string;
      displayName: string;
      bonusData?: BonusData;
      payrollData?: Record<string, number>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: employee.uid,
      displayName: employee.displayName,
      updatedAt: serverTimestamp(),
    };

    if (importPatch.bonusAmounts) {
      const bonusData = buildBonusData(importPatch.bonusAmounts);
      if (bonusData !== undefined) {
        doc.bonusData = bonusData;
      }
    }

    if (importPatch.payrollFields && Object.keys(importPatch.payrollFields).length > 0) {
      doc.payrollData = importPatch.payrollFields;
    }

    return doc;
  }

  private parseNumber(raw: string): number | null {
    const normalized = raw.replace(/,/g, '');
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }
}

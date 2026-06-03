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
import { MonthlySettingDataService } from '../monthly-setting/monthly-setting-data.service';
import {
  MonthlyImportColumnDef,
  MonthlyImportFieldKey,
  buildMonthlyImportColumnDefs,
} from '../monthly-setting/monthly-import-columns';
import { MonthlyListRow } from './monthly-list-columns';
import { MonthlyListDataService } from './monthly-list-data.service';

export interface MonthlyCsvImportOptions {
  yyyyMm: string;
  allRows: MonthlyListRow[];
  scopeEids?: Set<string>;
}

export interface MonthlyCsvImportResult {
  updated: number;
  skippedNoMatch: number;
  skippedOutOfScope: number;
  skippedAmbiguous: number;
  skippedEmpty: number;
}

@Injectable({ providedIn: 'root' })
export class MonthlyListImportService {
  private readonly firestore = inject(Firestore);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly listDataService = inject(MonthlyListDataService);

  async importFromCsv(
    tid: string,
    file: File,
    options: MonthlyCsvImportOptions,
  ): Promise<MonthlyCsvImportResult> {
    await this.monthlySettingDataService.loadSettings(tid);

    const columnDefs = buildMonthlyImportColumnDefs();
    const csvText = await file.text();
    const rows = this.parseCsvRows(csvText);
    if (rows.length < 2) {
      throw new Error('CSVにデータ行がありません。');
    }

    const headers = rows[0].map((h) => h.trim());
    const headerIndex = this.buildHeaderIndexMap(headers, columnDefs);

    const employeeIdIdx = headerIndex['employeeId'] ?? -1;
    const displayNameIdx = headerIndex['displayName'] ?? -1;
    if (employeeIdIdx === -1 && displayNameIdx === -1) {
      throw new Error('CSVに社員番号または氏名の列がありません。');
    }

    const scopeEids =
      options.scopeEids ?? new Set(options.allRows.map((r) => r.eid));

    const employeeLookup = await this.listDataService.loadEmployeeLookup(tid);
    const { eidByEmployeeId, eidsByDisplayName } =
      this.listDataService.buildMatchMaps(employeeLookup);

    const batch = writeBatch(this.firestore);
    const result: MonthlyCsvImportResult = {
      updated: 0,
      skippedNoMatch: 0,
      skippedOutOfScope: 0,
      skippedAmbiguous: 0,
      skippedEmpty: 0,
    };

    for (let i = 1; i < rows.length; i++) {
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
      if (!scopeEids.has(matched)) {
        result.skippedOutOfScope++;
        continue;
      }

      const existingRow = options.allRows.find((r) => r.eid === matched);
      const patch = this.buildMonthlyPatch(
        cols,
        headerIndex,
        columnDefs,
      );
      if (!patch) {
        result.skippedEmpty++;
        continue;
      }

      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        options.yyyyMm,
        'employees',
        matched,
      );
      batch.update(employeeRef, patch);

      result.updated++;
    }

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
    columnDefs: MonthlyImportColumnDef[],
  ): Record<string, number> {
    const map: Record<string, number> = {};
    const config = this.monthlySettingDataService.importHeaders();

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

  private buildMonthlyPatch(
    cols: string[],
    idx: Record<string, number>,
    columnDefs: MonthlyImportColumnDef[],
  ): UpdateData<DocumentData> | null {
    const update: Record<string, unknown> = {};
    let hasUpdate = false;

    const setPayrollIfPresent = (key: MonthlyImportFieldKey) => {
      const i = idx[key];
      if (i === undefined || i < 0) return;
      const raw = (cols[i] ?? '').trim();
      if (!raw) return;
      const num = this.parseNumber(raw);
      if (num === null) return;
      update[`payrollData.${key}`] = num;
      hasUpdate = true;
    };

    for (const col of columnDefs) {
      if (col.key === 'displayName' || col.key === 'employeeId') {
        continue;
      }
      if (col.kind === 'number') {
        setPayrollIfPresent(col.key);
      }
    }

    if (!hasUpdate) return null;

    update['updatedAt'] = serverTimestamp();
    return update as UpdateData<DocumentData>;
  }

  private parseNumber(raw: string): number | null {
    const normalized = raw.replace(/,/g, '');
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }
}

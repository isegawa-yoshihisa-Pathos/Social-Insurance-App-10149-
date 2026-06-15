import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  doc,
  getDocs,
  collection,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { MonthlySettingDataService } from '../monthly-setting/monthly-setting-data.service';
import {
  MonthlyImportColumnDef,
  buildMonthlyImportColumnDefs,
} from '../monthly-setting/monthly-import-columns';
import { PayrollData } from '../../monthly-document';
import { MonthlyListRow } from './monthly-list-columns';
import { EmployeeLookupEntry, MonthlyListDataService } from './monthly-list-data.service';
import { PaymentManagementDataService } from '../../payment-management/payment-management-data.service';
import { buildPayrollWageFields } from '../../payment-management/payment-list/payroll-wage-update.util';
import { resolveCsvImportLayout } from '../../csv/csv-file.util';

export interface MonthlyCsvImportOptions {
  yyyyMm: string;
}

export interface MonthlyCsvImportResult {
  updated: number;
  created: number;
  skippedNoMatch: number;
  skippedAmbiguous: number;
  skippedEmpty: number;
}

interface PayrollImportPatch {
  basicSalary?: number;
  fringeBenefits?: number;
  paymentBaseDays?: number;
  bonusRelatedRemuneration?: number;
  allowances?: Record<string, number>;
  retroactivePay?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MonthlyListImportService {
  private readonly firestore = inject(Firestore);
  private readonly monthlySettingDataService = inject(MonthlySettingDataService);
  private readonly paymentManagementDataService = inject(PaymentManagementDataService);
  private readonly listDataService = inject(MonthlyListDataService);

  async importFromCsv(
    tid: string,
    file: File,
    options: MonthlyCsvImportOptions,
  ): Promise<MonthlyCsvImportResult> {
    const csvText = await file.text();
    const rows = this.parseCsvRows(csvText);
    const layout = resolveCsvImportLayout(rows);
    if (rows.length < layout.dataStartIndex + 1) {
      throw new Error('CSVにデータ行がありません。');
    }
    const targetYyyyMm = layout.yyyyMmFromFile ?? options.yyyyMm;

    if (await this.listDataService.isPeriodLocked(tid, targetYyyyMm)) {
      throw new Error('この月は締切済みのため、インポートできません。');
    }

    await Promise.all([
      this.monthlySettingDataService.loadSettings(tid),
      this.paymentManagementDataService.loadPaymentSettings(tid),
    ]);

    const columnDefs = buildMonthlyImportColumnDefs(
      this.paymentManagementDataService.allowanceTypeDefinitions(),
    );
    const headers = rows[layout.headerRowIndex].map((h) => h.trim());
    const headerIndex = this.buildHeaderIndexMap(headers, columnDefs);

    const employeeIdIdx = headerIndex['employeeId'] ?? -1;
    const displayNameIdx = headerIndex['displayName'] ?? -1;
    if (employeeIdIdx === -1 && displayNameIdx === -1) {
      throw new Error('CSVに社員番号または氏名の列がありません。');
    }

    const employeeLookup = await this.listDataService.loadEmployeeLookup(tid);
    const { eidByEmployeeId, eidsByDisplayName } =
      this.listDataService.buildMatchMaps(employeeLookup);

    const definitions = this.paymentManagementDataService.allowanceTypeDefinitions();
    const batch = writeBatch(this.firestore);
    const result: MonthlyCsvImportResult = {
      updated: 0,
      created: 0,
      skippedNoMatch: 0,
      skippedAmbiguous: 0,
      skippedEmpty: 0,
    };

    const existingRecordsSnapshot = await getDocs(
      collection(this.firestore, 'tenants', tid, 'monthly-records', targetYyyyMm, 'employees')
    );
    const existingRows = existingRecordsSnapshot.docs.map(doc => ({ ...doc.data() as MonthlyListRow }));
    const previousBonusMap = await this.listDataService.loadPreviousBonusRelatedRemunerationMap(
      tid,
      targetYyyyMm,
    );

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

      const existingRow = existingRows.find((r) => r.eid === matched);
      const payrollPatch = this.extractPayrollPatch(
        cols,
        headerIndex,
        columnDefs,
        existingRow,
      );
      if (!payrollPatch) {
        result.skippedEmpty++;
        continue;
      }

      const employeeRef = doc(
        this.firestore,
        'tenants',
        tid,
        'monthly-records',
        targetYyyyMm,
        'employees',
        matched,
      );

      if (existingRow) {
        if (payrollPatch.bonusRelatedRemuneration === undefined) {
          const previousBonus = previousBonusMap.get(matched) ?? 0;
          const currentBonus = existingRow.bonusRelatedRemuneration;
          if (
            currentBonus == null ||
            (currentBonus === 0 && previousBonus > 0)
          ) {
            payrollPatch.bonusRelatedRemuneration = previousBonus;
          }
        }
        batch.update(
          employeeRef,
          this.buildMonthlyUpdatePayload(payrollPatch, existingRow, definitions),
        );
        result.updated++;
      } else {
        const employee = employeeLookup.get(matched);
        if (!employee) {
          result.skippedNoMatch++;
          continue;
        }
        batch.set(
          employeeRef,
          this.buildMonthlyDocument(
            employee,
            payrollPatch,
            definitions,
            previousBonusMap.get(matched) ?? 0,
          ),
        );
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

  private extractPayrollPatch(
    cols: string[],
    idx: Record<string, number>,
    columnDefs: MonthlyImportColumnDef[],
    existingRow: MonthlyListRow | undefined,
  ): PayrollImportPatch | null {
    const current = {
      basicSalary: existingRow?.basicSalary ?? 0,
      fringeBenefits: existingRow?.fringeBenefits ?? 0,
      paymentBaseDays: existingRow?.paymentBaseDays ?? 0,
      bonusRelatedRemuneration: existingRow?.bonusRelatedRemuneration ?? 0,
      allowances: { ...(existingRow?.allowances ?? {}) },
      retroactivePay: existingRow?.retroactivePay ?? null,
    };

    const patch: PayrollImportPatch = {};
    let hasUpdate = false;

    for (const col of columnDefs) {
      if (col.key === 'displayName' || col.key === 'employeeId' || col.kind !== 'number') {
        continue;
      }

      const i = idx[col.key];
      if (i === undefined || i < 0) continue;
      const raw = (cols[i] ?? '').trim();
      if (!raw) continue;
      const num = this.parseNumber(raw);
      if (num === null) continue;

      if (col.key === 'basicSalary') {
        patch.basicSalary = num;
        hasUpdate = true;
      } else if (col.key === 'fringeBenefits') {
        patch.fringeBenefits = num;
        hasUpdate = true;
      } else if (col.key === 'retroactivePay') {
        patch.retroactivePay = num;
        hasUpdate = true;
      } else if (col.key === 'paymentBaseDays') {
        patch.paymentBaseDays = num;
        hasUpdate = true;
      } else if (col.key === 'bonusRelatedRemuneration') {
        patch.bonusRelatedRemuneration = num;
        hasUpdate = true;
      } else {
        const allowances = { ...(patch.allowances ?? current.allowances) };
        allowances[col.key] = num;
        patch.allowances = allowances;
        hasUpdate = true;
      }
    }

    return hasUpdate ? patch : null;
  }

  private buildMonthlyUpdatePayload(
    payrollPatch: PayrollImportPatch,
    existingRow: MonthlyListRow,
    definitions: ReturnType<PaymentManagementDataService['allowanceTypeDefinitions']>,
  ): UpdateData<DocumentData> {
    const current = {
      basicSalary: existingRow.basicSalary ?? 0,
      fringeBenefits: existingRow.fringeBenefits ?? 0,
      allowances: { ...(existingRow.allowances ?? {}) },
      retroactivePay: existingRow.retroactivePay ?? null,
    };

    const wages = buildPayrollWageFields(current, payrollPatch, definitions);
    const update: Record<string, unknown> = {
      'payrollData.fixedWage': wages.fixedWage,
      'payrollData.variableWage': wages.variableWage,
      updatedAt: serverTimestamp(),
    };

    if (payrollPatch.basicSalary !== undefined) {
      update['payrollData.basicSalary'] = payrollPatch.basicSalary;
    }
    if (payrollPatch.fringeBenefits !== undefined) {
      update['payrollData.fringeBenefits'] = payrollPatch.fringeBenefits;
    }
    if (payrollPatch.paymentBaseDays !== undefined) {
      update['payrollData.paymentBaseDays'] = payrollPatch.paymentBaseDays;
    }
    if (payrollPatch.bonusRelatedRemuneration !== undefined) {
      update['bonusRelatedRemuneration'] = payrollPatch.bonusRelatedRemuneration;
    }
    if (payrollPatch.retroactivePay !== undefined) {
      update['payrollData.retroactivePay'] = payrollPatch.retroactivePay;
    }
    if (payrollPatch.allowances !== undefined) {
      for (const [type, amount] of Object.entries(payrollPatch.allowances)) {
        update[`payrollData.allowances.${type}`] = amount;
      }
    }

    return update as UpdateData<DocumentData>;
  }

  private buildMonthlyDocument(
    employee: EmployeeLookupEntry,
    payrollPatch: PayrollImportPatch,
    definitions: ReturnType<PaymentManagementDataService['allowanceTypeDefinitions']>,
    carriedBonusRelatedRemuneration: number,
  ): {
    uid: string;
    displayName: string;
    paymentBaseDays: number;
    bonusRelatedRemuneration: number;
    payrollData: PayrollData;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } {
    const current = {
      basicSalary: 0,
      fringeBenefits: 0,
      paymentBaseDays: 0,
      allowances: {},
      retroactivePay: null,
    };

    const wages = buildPayrollWageFields(current, payrollPatch, definitions);

    const payrollData: PayrollData = {
      basicSalary: payrollPatch.basicSalary ?? 0,
      fringeBenefits: payrollPatch.fringeBenefits ?? 0,
      fixedWage: wages.fixedWage,
      variableWage: wages.variableWage,
      allowances: payrollPatch.allowances ?? {},
      retroactivePay: payrollPatch.retroactivePay ?? 0,
    };

    return {
      uid: employee.uid,
      displayName: employee.displayName,
      paymentBaseDays: payrollPatch.paymentBaseDays ?? 0,
      bonusRelatedRemuneration:
        payrollPatch.bonusRelatedRemuneration ?? carriedBonusRelatedRemuneration,
      payrollData,
      updatedAt: serverTimestamp(),
    };
  }

  private parseNumber(raw: string): number | null {
    const normalized = raw.replace(/,/g, '');
    const num = Number(normalized);
    return Number.isNaN(num) ? null : num;
  }
}


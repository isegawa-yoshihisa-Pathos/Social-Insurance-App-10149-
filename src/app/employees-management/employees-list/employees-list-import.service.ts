import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, serverTimestamp, writeBatch, UpdateData, DocumentData } from '@angular/fire/firestore';
import { toFirestoreTimestamp, toFormDate } from '../../date-utils';
import { EmployeesSettingDataService } from '../employees-setting/employees-setting-data.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { EMPLOYEES_IMPORT_COLUMNS, EmployeesImportFieldKey } from '../employees-setting/employees-import-columns';
import { EmployeeListRow } from './employee-list-columns';

export interface EmployeesCsvImportOptions {
  allRows: EmployeeListRow[];
  scopeEids?: Set<string>;
}

export interface EmployeesCsvImportResult {
  updated: number;
  skippedNoMatch: number;
  skippedOutOfScope: number;
  skippedAmbiguous: number;
  skippedEmpty: number;
}

@Injectable({ providedIn: 'root' })
export class EmployeesListImportService {
  private readonly firestore = inject(Firestore);
  private readonly employeesSettingDataService = inject(EmployeesSettingDataService);
  private readonly auditLog = inject(AuditLogService);

  async importFromCsv(
    tid: string,
    file: File,
    options: EmployeesCsvImportOptions,
  ): Promise<EmployeesCsvImportResult> {
    await this.employeesSettingDataService.loadSettings(tid);

    const csvText = await file.text();
    const rows = this.parseCsvRows(csvText);
    if (rows.length < 2) {
      throw new Error('CSVにデータ行がありません。');
    }

    const headers = rows[0].map((h) => h.trim());
    const headerIndex = this.buildHeaderIndexMap(headers);

    const employeeIdIdx = headerIndex.employeeId;
    const displayNameIdx = headerIndex.displayName;
    if (employeeIdIdx === -1 && displayNameIdx === -1) {
      throw new Error('CSVに社員番号または氏名の列がありません。');
    }

    const scopeEids =
      options.scopeEids ?? new Set(options.allRows.map((r) => r.eid));

    const eidByEmployeeId = new Map<string, string>();
    const eidsByDisplayName = new Map<string, string[]>();

    for (const row of options.allRows) {
      const empId = row.employeeId.trim().toLowerCase();
      if (empId) eidByEmployeeId.set(empId, row.eid);

      const name = row.displayName.trim().toLowerCase();
      if (name) {
        const arr = eidsByDisplayName.get(name) ?? [];
        arr.push(row.eid);
        eidsByDisplayName.set(name, arr);
      }
    }

    const batch = writeBatch(this.firestore);
    const result: EmployeesCsvImportResult = {
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

      const patch = this.buildEmployeePatch(cols, headerIndex);
      if (!patch) {
        result.skippedEmpty++;
        continue;
      }

      const employeeRef = doc(this.firestore, 'tenants', tid, 'employees', matched);
      batch.update(employeeRef, patch.employee);

      if (patch.affiliation) {
        const snap = await getDoc(employeeRef);
        if (snap.exists()) {
          const uid = String(snap.data()?.['uid'] ?? '');
          if (uid) {
            const affiliationRef = doc(this.firestore, 'affiliations', `${uid}_${tid}`);
            batch.set(affiliationRef, patch.affiliation, { merge: true });
          }
        }
      }

      result.updated++;
    }

    await batch.commit();

    await this.auditLog.recordCreate({
      tid,
      category: 'employee.import',
      summary: '従業員CSVをインポート',
      target: this.auditLog.tenantTarget(tid),
      metadata: { ...result, fileName: file.name },
    });

    return result;
  }

  private parseCsvRows(text: string): string[][] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(',').map((c) => c.trim()));
  }

  private buildHeaderIndexMap(headers: string[]): Record<EmployeesImportFieldKey, number> {
    const map = {} as Record<EmployeesImportFieldKey, number>;
    const config = this.employeesSettingDataService.importHeaders();

    for (const col of EMPLOYEES_IMPORT_COLUMNS) {
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

  private buildEmployeePatch(
    cols: string[],
    idx: Record<EmployeesImportFieldKey, number>,
  ): {
    employee: UpdateData<DocumentData>;
    affiliation?: Record<string, unknown>;
  } | null {
    const employee: Record<string, unknown> = {};
    let hasUpdate = false;

    const setIfPresent = (key: EmployeesImportFieldKey, setter: (value: string) => void) => {
      const i = idx[key];
      if (i < 0) return;
      const raw = (cols[i] ?? '').trim();
      if (!raw) return;
      setter(raw);
      hasUpdate = true;
    };

    setIfPresent('displayName', (v) => {
      employee['employeePersonalInfo.displayName'] = v;
    });
    setIfPresent('employeeId', (v) => {
      employee['employeeEmployInfo.employeeId'] = v;
    });
    setIfPresent('position', (v) => {
      employee['employeeEmployInfo.position'] = v;
    });
    setIfPresent('department', (v) => {
      employee['employeeEmployInfo.department'] = v;
    });
    setIfPresent('healthInsuranceRecordNumber', (v) => {
      employee['employeeEmployInfo.healthInsuranceRecordNumber'] = v;
    });
    setIfPresent('pensionInsuranceRecordNumber', (v) => {
      employee['employeeEmployInfo.pensionInsuranceRecordNumber'] = v;
    });

    setIfPresent('payType', (v) => {
      if (['monthly', 'daily-monthly', 'weekly', 'daily', 'hourly'].includes(v)) {
        employee['employeeEmployInfo.payType'] = v;
      } else if (v === '完全月給') {
        employee['employeeEmployInfo.payType'] = 'monthly';
      } else if (v === '日給月給') {
        employee['employeeEmployInfo.payType'] = 'daily-monthly';
      } else if (v === '週給') {
        employee['employeeEmployInfo.payType'] = 'weekly';
      } else if (v === '日給') {
        employee['employeeEmployInfo.payType'] = 'daily';
      } else if (v === '時給') {
        employee['employeeEmployInfo.payType'] = 'hourly';
      }
    });
    setIfPresent('employmentType', (v) => {
      if (['full-time', 'short-time-worker', 'short-time-labor'].includes(v)) {
        employee['employeeEmployInfo.employmentType'] = v;
      } else if (v === '正社員') {
        employee['employeeEmployInfo.employmentType'] = 'full-time';
      } else if (v === '短時間就労者') {
        employee['employeeEmployInfo.employmentType'] = 'short-time-worker';
      } else if (v === '短時間労働者') {
        employee['employeeEmployInfo.employmentType'] = 'short-time-labor';
      }
    });
    setIfPresent('status', (v) => {
      if (['active', 'leave', 'resigned'].includes(v)) {
        employee['employeeEmployInfo.status'] = v;
      } else if (v === '在職') {
        employee['employeeEmployInfo.status'] = 'active';
      } else if (v === '休職') {
        employee['employeeEmployInfo.status'] = 'leave';
      } else if (v === '退職') {
        employee['employeeEmployInfo.status'] = 'resigned';
      }
    });

    for (const key of [
      'joinedAt', 'resignAt', 'licenseStartAt', 'licenseEndAt',
    ] as EmployeesImportFieldKey[]) {
      setIfPresent(key, (v) => {
        const date = toFormDate(v.trim());
        if (date) {
          employee[`employeeEmployInfo.${key}`] = toFirestoreTimestamp(date);
        }
      });
    }

    let affiliation: Record<string, unknown> | undefined;

    setIfPresent('role', (v) => {
      if (v === 'admin' || v === 'member') {
        employee['role'] = v;
        affiliation = { ...(affiliation ?? {}), role: v };
      } else if (v === '管理者') {
        employee['role'] = 'admin';
        affiliation = { ...(affiliation ?? {}), role: 'admin' };
      } else if (v === '一般') {
        employee['role'] = 'member';
        affiliation = { ...(affiliation ?? {}), role: 'member' };
      }
    });

    const statusIdx = idx.status;
    if (statusIdx >= 0) {
      const status = (cols[statusIdx] ?? '').trim();
      if (status) {
        const mapped =
          status === 'leave' ? 'leave' :
          status === 'resigned' ? 'resigned' :
          status === 'active' ? 'active' : null;
        if (mapped) {
          affiliation = { ...(affiliation ?? {}), status: mapped };
        }
      }
    }

    if (!hasUpdate) return null;

    employee['updatedAt'] = serverTimestamp();
    if (affiliation) {
      affiliation['updatedAt'] = serverTimestamp();
    }

    return { 
      employee: employee as UpdateData<DocumentData>,
      affiliation,
    };
  }
}
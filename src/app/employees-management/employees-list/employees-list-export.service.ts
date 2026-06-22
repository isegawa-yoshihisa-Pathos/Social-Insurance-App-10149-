import { Injectable } from '@angular/core';
import {
  buildDefaultEmployeesImportHeaders,
  EMPLOYEES_IMPORT_COLUMNS,
  EmployeesImportFieldKey,
} from '../employees-setting/employees-import-columns';
import { EmployeeListColumnKey, EmployeeListRow } from './employee-list-columns';
import { escapeCsvCell, resolveImportStyleHeader } from '../../csv/csv-file.util';
import { formatEmployeeListValue } from './employee-list-data.util';

const IMPORT_COLUMN_KEYS = new Set<string>(
  EMPLOYEES_IMPORT_COLUMNS.map((col) => col.key),
);

@Injectable({ providedIn: 'root' })
export class EmployeesListExportService {
  buildCsv(
    visibleColumns: EmployeeListColumnKey[],
    rows: EmployeeListRow[],
    importHeaders: Record<string, string>,
  ): string {
    const defaultHeaders = buildDefaultEmployeesImportHeaders();
    const headers = visibleColumns.map((column) =>
      this.resolveHeader(column, importHeaders, defaultHeaders),
    );
    const dataRows = rows.map((row) =>
      visibleColumns.map((column) => this.exportCellValue(row, column)),
    );

    return [
      headers.map(escapeCsvCell).join(','),
      ...dataRows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\n');
  }

  private resolveHeader(
    column: EmployeeListColumnKey,
    importHeaders: Record<string, string>,
    defaultHeaders: Record<string, string>,
  ): string {
    if (IMPORT_COLUMN_KEYS.has(column)) {
      return resolveImportStyleHeader(
        column as EmployeesImportFieldKey,
        importHeaders,
        defaultHeaders,
      );
    }
    return column;
  }

  private exportCellValue(row: EmployeeListRow, column: EmployeeListColumnKey): string {
    const value = row[column];
    if (column === 'age') {
      return value == null || value === '' ? '' : String(value);
    }
    if (typeof value === 'boolean') {
      return formatEmployeeListValue(value);
    }
    return formatEmployeeListValue(String(value ?? ''));
  }
}

import { Injectable } from '@angular/core';
import { AllowanceTypeDefinition } from '../../payment-document';
import {
  buildMonthlyImportColumnDefs,
} from '../monthly-setting/monthly-import-columns';
import { MonthlyListColumnKey, MonthlyListRow } from './monthly-list-columns';
import { monthlyListSortValue } from './monthly-list-row.mapper';
import {
  buildImportStyleCsv,
  formatExportNumber,
  resolveImportStyleHeader,
} from '../../csv/csv-file.util';

@Injectable({ providedIn: 'root' })
export class MonthlyListExportService {
  buildCsv(
    yyyyMm: string,
    visibleColumns: MonthlyListColumnKey[],
    rows: MonthlyListRow[],
    importHeaders: Record<string, string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
  ): string {
    const columnDefs = buildMonthlyImportColumnDefs(allowanceDefinitions);
    const defaultHeaders = Object.fromEntries(
      columnDefs.map((col) => [col.key, col.defaultHeader]),
    );

    const headers = visibleColumns.map((column) =>
      resolveImportStyleHeader(column, importHeaders, defaultHeaders),
    );
    const dataRows = rows.map((row) =>
      visibleColumns.map((column) => this.exportCellValue(row, column)),
    );

    return buildImportStyleCsv(yyyyMm, headers, dataRows);
  }

  private exportCellValue(row: MonthlyListRow, column: MonthlyListColumnKey): string {
    if (column === 'displayName' || column === 'employeeId') {
      return String(row[column] ?? '');
    }

    const value = monthlyListSortValue(row, column);
    if (typeof value === 'number') {
      return formatExportNumber(value);
    }
    return String(value ?? '');
  }
}

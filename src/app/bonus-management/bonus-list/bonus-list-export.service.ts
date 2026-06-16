import { Injectable } from '@angular/core';
import { BonusTypeDefinition } from '../../bonus-document';
import {
  buildBonusImportColumnDefs,
} from '../bonus-setting/bonus-import-columns';
import { BonusDetailRow } from './bonus-list-data.service';
import { BonusListColumnKey, BonusListRow } from './bonus-list-columns';
import { BonusDetailColumnKey } from './bonus-list-row.mapper';
import { bonusListSortValue } from './bonus-list-row.mapper';
import {
  buildImportStyleCsv,
  formatExportNumber,
  resolveImportStyleHeader,
} from '../../csv/csv-file.util';

@Injectable({ providedIn: 'root' })
export class BonusListExportService {
  buildCsv(
    yyyyMm: string,
    visibleColumns: BonusListColumnKey[],
    rows: BonusListRow[],
    importHeaders: Record<string, string>,
    bonusDefinitions: BonusTypeDefinition[],
  ): string {
    const columnDefs = buildBonusImportColumnDefs(bonusDefinitions);
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

  private exportCellValue(row: BonusListRow, column: BonusListColumnKey): string {
    if (column === 'displayName' || column === 'employeeId') {
      return String(row[column] ?? '');
    }

    const value = bonusListSortValue(row, column);
    if (typeof value === 'number') {
      return formatExportNumber(value);
    }
    return String(value ?? '');
  }

  buildEmployeeHistoryCsv(
    fileLabel: string,
    visibleColumns: readonly BonusDetailColumnKey[],
    rows: BonusDetailRow[],
    importHeaders: Record<string, string>,
    bonusDefinitions: BonusTypeDefinition[],
  ): string {
    const columnDefs = buildBonusImportColumnDefs(bonusDefinitions);
    const defaultHeaders = Object.fromEntries(
      columnDefs.map((col) => [col.key, col.defaultHeader]),
    );

    const headers = visibleColumns.map((column) =>
      column === 'yyyyMm'
        ? 'yyyyMm'
        : resolveImportStyleHeader(column, importHeaders, defaultHeaders),
    );
    const dataRows = rows.map((row) =>
      visibleColumns.map((column) => {
        if (column === 'yyyyMm') return row.yyyyMm;
        return this.exportCellValue(row, column);
      }),
    );

    return buildImportStyleCsv(fileLabel, headers, dataRows);
  }
}

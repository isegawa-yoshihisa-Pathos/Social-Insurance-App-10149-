import { Injectable } from '@angular/core';
import { BonusTypeDefinition } from '../../bonus-document';
import { AllowanceTypeDefinition } from '../../payment-document';
import { buildBonusImportColumnDefs } from '../../bonus-management/bonus-setting/bonus-import-columns';
import { buildMonthlyImportColumnDefs } from '../../monthly-management/monthly-setting/monthly-import-columns';
import { PaymentDetailRow } from './payment-list-data.service';
import { PaymentListColumnKey, PaymentListRow } from './payment-list-columns';
import { PaymentDetailColumnKey } from './payment-list-row.mapper';
import { paymentListSortValue } from './payment-list-row.mapper';
import {
  buildImportStyleCsv,
  formatExportNumber,
  resolveImportStyleHeader,
} from '../../csv/csv-file.util';

@Injectable({ providedIn: 'root' })
export class PaymentListExportService {
  buildCsv(
    yyyyMm: string,
    visibleColumns: PaymentListColumnKey[],
    rows: PaymentListRow[],
    monthlyImportHeaders: Record<string, string>,
    bonusImportHeaders: Record<string, string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): string {
    const monthlyDefaults = Object.fromEntries(
      buildMonthlyImportColumnDefs(allowanceDefinitions).map((col) => [col.key, col.defaultHeader]),
    );
    const bonusDefaults = Object.fromEntries(
      buildBonusImportColumnDefs(bonusDefinitions).map((col) => [col.key, col.defaultHeader]),
    );

    const headers = visibleColumns.map((column) =>
      this.resolveHeader(
        column,
        monthlyImportHeaders,
        bonusImportHeaders,
        monthlyDefaults,
        bonusDefaults,
      ),
    );
    const dataRows = rows.map((row) =>
      visibleColumns.map((column) =>
        this.exportCellValue(row, column, allowanceDefinitions, bonusDefinitions),
      ),
    );

    return buildImportStyleCsv(yyyyMm, headers, dataRows);
  }

  private resolveHeader(
    column: PaymentListColumnKey,
    monthlyImportHeaders: Record<string, string>,
    bonusImportHeaders: Record<string, string>,
    monthlyDefaults: Record<string, string>,
    bonusDefaults: Record<string, string>,
  ): string {
    if (column in bonusDefaults || column.startsWith('bonus-')) {
      return resolveImportStyleHeader(column, bonusImportHeaders, bonusDefaults);
    }
    return resolveImportStyleHeader(column, monthlyImportHeaders, monthlyDefaults);
  }

  private exportCellValue(
    row: PaymentListRow,
    column: PaymentListColumnKey,
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): string {
    if (column === 'displayName' || column === 'employeeId') {
      return String(row[column] ?? '');
    }

    const value = paymentListSortValue(row, column, allowanceDefinitions, bonusDefinitions);
    if (typeof value === 'number') {
      return formatExportNumber(value);
    }
    return String(value ?? '');
  }

  buildEmployeeHistoryCsv(
    fileLabel: string,
    visibleColumns: readonly PaymentDetailColumnKey[],
    rows: PaymentDetailRow[],
    monthlyImportHeaders: Record<string, string>,
    bonusImportHeaders: Record<string, string>,
    allowanceDefinitions: AllowanceTypeDefinition[],
    bonusDefinitions: BonusTypeDefinition[],
  ): string {
    const monthlyDefaults = Object.fromEntries(
      buildMonthlyImportColumnDefs(allowanceDefinitions).map((col) => [col.key, col.defaultHeader]),
    );
    const bonusDefaults = Object.fromEntries(
      buildBonusImportColumnDefs(bonusDefinitions).map((col) => [col.key, col.defaultHeader]),
    );

    const headers = visibleColumns.map((column) =>
      column === 'yyyyMm'
        ? 'yyyyMm'
        : this.resolveHeader(
            column,
            monthlyImportHeaders,
            bonusImportHeaders,
            monthlyDefaults,
            bonusDefaults,
          ),
    );
    const dataRows = rows.map((row) =>
      visibleColumns.map((column) => {
        if (column === 'yyyyMm') return row.yyyyMm;
        return this.exportCellValue(row, column, allowanceDefinitions, bonusDefinitions);
      }),
    );

    return buildImportStyleCsv(fileLabel, headers, dataRows);
  }
}

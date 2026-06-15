export interface CsvImportLayout {
  yyyyMmFromFile: string | null;
  headerRowIndex: number;
  dataStartIndex: number;
}

const YYYY_MM_PATTERN = /^\d{4}-\d{2}$/;

export function resolveCsvImportLayout(rows: string[][]): CsvImportLayout {
  const firstCell = (rows[0]?.[0] ?? '').trim();
  if (YYYY_MM_PATTERN.test(firstCell)) {
    return {
      yyyyMmFromFile: firstCell,
      headerRowIndex: 1,
      dataStartIndex: 2,
    };
  }

  return {
    yyyyMmFromFile: null,
    headerRowIndex: 0,
    dataStartIndex: 1,
  };
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildImportStyleCsv(
  yyyyMm: string,
  headers: string[],
  rows: string[][],
): string {
  const lines = [
    escapeCsvCell(yyyyMm),
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\n');
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function resolveImportStyleHeader(
  key: string,
  importHeaders: Record<string, string>,
  defaultHeaders: Record<string, string>,
): string {
  return (importHeaders[key] ?? defaultHeaders[key] ?? key).trim();
}

export function formatExportNumber(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  return value;
}

import { Injectable } from '@angular/core';
import {
  isRegistrationCsvFormType,
  RegistrationFilingSavePayload,
} from '../../../shared/registration-filing-document';
import { buildRegistrationCsvFile } from '../../../shared/registration-csv';

@Injectable({ providedIn: 'root' })
export class RegistrationCsvExportService {
  buildCsvContent(filings: RegistrationFilingSavePayload[]): string {
    const formType = filings[0]?.formType;
    if (!formType || !isRegistrationCsvFormType(formType)) {
      throw new Error('CSV出力に対応していない届出種別です。');
    }
    return buildRegistrationCsvFile(formType, filings);
  }

  downloadCsv(filings: RegistrationFilingSavePayload[], formLabel: string): void {
    const content = this.buildCsvContent(filings);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([content], { type: 'text/csv;charset=shift_jis' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${formLabel}_${timestamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

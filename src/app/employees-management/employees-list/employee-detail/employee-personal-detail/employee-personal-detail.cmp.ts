import { Component, inject } from '@angular/core';
import { formatJapaneseDate } from '../../../../date-utils';
import { DEPENDENT_RELATIONSHIP_LABELS } from '../../../../personal-document';
import { formatDependentDisplayName } from '../../../../personal-form-data';
import { EmployeeDetailDataService } from '../employee-detail-data.service';

@Component({
  selector: 'app-employee-personal-detail',
  imports: [],
  templateUrl: './employee-personal-detail.cmp.html',
  styleUrls: [
    './employee-personal-detail.cmp.css',
    '../../../../personal-setting/employee-info/employee-info.cmp.css',
  ],
})
export class EmployeePersonalDetailCmp {
  readonly dataService = inject(EmployeeDetailDataService);

  readonly formatDate = formatJapaneseDate;
  readonly formatDependentName = formatDependentDisplayName;
  readonly relationshipLabel = (value: keyof typeof DEPENDENT_RELATIONSHIP_LABELS) =>
    DEPENDENT_RELATIONSHIP_LABELS[value] ?? '';
}

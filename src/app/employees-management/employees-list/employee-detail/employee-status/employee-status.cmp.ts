import { Component, inject } from '@angular/core';
import { EmployeeDetailDataService } from '../employee-detail-data.service';
import {
  buildEmployeeStatusTimeline,
  employmentStatusLabel,
  formatLeavePeriod,
} from '../../../../employee-leave.util';
import { formatJapaneseDate } from '../../../../date-utils';

@Component({
  selector: 'app-employee-status',
  imports: [],
  templateUrl: './employee-status.cmp.html',
  styleUrls: [
    './employee-status.cmp.css',
    '../../../../personal-setting/employee-info/employee-info.cmp.css',
  ],
})
export class EmployeeStatusCmp {
  readonly dataService = inject(EmployeeDetailDataService);

  readonly statusLabel = employmentStatusLabel;
  readonly formatDate = formatJapaneseDate;
  readonly formatLeavePeriod = formatLeavePeriod;

  timeline() {
    return buildEmployeeStatusTimeline({
      joinedAt: this.dataService.employForm.joinedAt,
      resignAt: this.dataService.employForm.resignAt,
      leaveRecords: this.dataService.leaveRecords,
    });
  }
}

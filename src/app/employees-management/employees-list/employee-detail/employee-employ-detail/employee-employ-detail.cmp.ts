import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { formatJapaneseDate } from '../../../../date-utils';
import { EmployeeDetailDataService } from '../employee-detail-data.service';
import { RoutesService } from '../../../../routes.service';

@Component({
  selector: 'app-employee-employ-detail',
  imports: [MatButtonModule],
  templateUrl: './employee-employ-detail.cmp.html',
  styleUrls: [
    './employee-employ-detail.cmp.css',
    '../../../../personal-setting/employee-info/employee-info.cmp.css',
  ],
})
export class EmployeeEmployDetailCmp {
  readonly dataService = inject(EmployeeDetailDataService);
  private readonly routesService = inject(RoutesService);

  readonly formatDate = formatJapaneseDate;
  readonly statusLabel = (status: 'active' | 'leave' | 'resigned') => {
    return status === 'active' ? '在職' : status === 'leave' ? '休職' : '退職';
  };

  edit(): void {
    this.routesService.redirectToEmployeeEmployDetailEdit(this.dataService.eid);
  }
}

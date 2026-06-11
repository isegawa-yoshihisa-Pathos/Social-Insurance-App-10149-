import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { formatJapaneseDate } from '../../../../date-utils';
import { EmployeeDetailDataService } from '../employee-detail-data.service';
import { RoutesService } from '../../../../routes.service';
import { Router } from '@angular/router';
import { formatEmployeeListValue } from '../../employee-list-data.util';

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
  private readonly router = inject(Router);

  readonly formatDate = formatJapaneseDate;

  edit(): void {
    this.routesService.redirectToEmployeeEmployDetailEdit(this.dataService.eid);
  }

  isManagement(): boolean {
    return this.router.url.startsWith('/employees-management');
  }

  formatValue(value: string): string {
    return formatEmployeeListValue(value);
  }
}

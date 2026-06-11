import { Component } from '@angular/core';
import { EmployeeEmployDetailCmp } from '../employees-management/employees-list/employee-detail/employee-employ-detail/employee-employ-detail.cmp';
import { EmployeeStatusCmp } from '../employees-management/employees-list/employee-detail/employee-status/employee-status.cmp';

@Component({
  selector: 'app-main-page',
  imports: [EmployeeEmployDetailCmp, EmployeeStatusCmp],
  templateUrl: './main-page.cmp.html',
  styleUrl: './main-page.cmp.css',
})
export class MainPageCmp {
}
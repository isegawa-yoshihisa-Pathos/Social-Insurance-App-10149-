import { Component } from '@angular/core';
import { EmployeesListHeaderSettingCmp } from './employees-list-header-setting/employees-list-header-setting.cmp';
import { EmployeesImportSettingCmp } from './employees-import-setting/employees-import-setting.cmp';

@Component({
  selector: 'app-employees-setting',
  imports: [EmployeesListHeaderSettingCmp, EmployeesImportSettingCmp],
  templateUrl: './employees-setting.cmp.html',
  styleUrl: './employees-setting.cmp.css',
})
export class EmployeesSettingCmp {

}

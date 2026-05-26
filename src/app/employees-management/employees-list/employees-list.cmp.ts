import { Component, inject } from '@angular/core';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeesListDisplayCmp } from './employees-list-display/employees-list-display.cmp';

@Component({
  selector: 'app-employees-list',
  imports: [EmployeesListDisplayCmp],
  templateUrl: './employees-list.cmp.html',
  styleUrl: './employees-list.cmp.css',
})
export class EmployeesListCmp {
  private readonly currentTenantService = inject(CurrentTenantService);
  tid = this.currentTenantService.getTenant() ?? '';
}

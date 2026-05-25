import { Component, inject, OnInit } from '@angular/core';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { EmployeesListCmp } from '../employees-list/employees-list.cmp';
import { MatTableModule } from '@angular/material/table';
import { CurrentTenantService } from '../current-tenant.service';
import { RoutesService } from '../routes.service';

@Component({
  selector: 'app-employees-management',
  imports: [MatTabGroup, MatTab, MatTableModule, EmployeesListCmp],
  templateUrl: './employees-management.cmp.html',
  styleUrl: './employees-management.cmp.css',
})
export class EmployeesManagementCmp implements OnInit {
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly routesService = inject(RoutesService);

  eid = '';

  async ngOnInit(): Promise<void> {
    const eid = this.currentTenantService.getTenant();
    if (!eid) {
      this.routesService.redirectToHome();
      return;
    }
    this.eid = eid;
  }
}
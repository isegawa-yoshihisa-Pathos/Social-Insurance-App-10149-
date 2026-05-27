import { Component, inject, ViewChild, effect, computed } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { RoutesService } from '../../routes.service';
import { CurrentTenantService } from '../../current-tenant.service';
import { EmployeesManagementDataService } from '../employees-management-data.service';
import { EmployeeListColumnKey, EmployeeListRow, EMPLOYEE_LIST_COLUMN_LABELS } from '../../employee-list-columns';

@Component({
  selector: 'app-employees-list',
  imports: [MatTableModule, MatSortModule, FormsModule, MatSelectModule, MatInputModule],
  templateUrl: './employees-list.cmp.html',
  styleUrl: './employees-list.cmp.css',
})
export class EmployeesListCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly dataService = inject(EmployeesManagementDataService);

  readonly employeeListColumnLabels = EMPLOYEE_LIST_COLUMN_LABELS;
  readonly visibleColumns = computed(() => this.dataService.visibleColumns());

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<EmployeeListRow>([]);

  loading = true;

  searchTargetColumn: EmployeeListColumnKey = 'displayName';
  searchQuery: string = '';

  constructor() {
    effect(async () => {
      const tid = this.currentTenantService.currentTid();
      if (!tid) {
        this.dataSource.data = [];
        this.loading = false;
        return;
      }
      this.loadEmployees(tid);
      await this.dataService.loadListSettings(tid);
    });

    this.dataSource.filterPredicate = (data: EmployeeListRow, filter: string) => {
      const searchCondition = JSON.parse(filter);
      const column = searchCondition.column as keyof EmployeeListRow;
      const query = searchCondition.query;

      const value = data[column as keyof EmployeeListRow];
      return value ? String(value).toLowerCase().includes(query) : false;
    };
  }

  private async loadEmployees(tid: string): Promise<void> {
    this.loading = true;
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const data = employees.docs.map((doc) => ({
      eid: doc.id,
      ...(doc.data() as Omit<EmployeeListRow, 'eid'>),
    }));
    this.dataSource.data = data;
    this.loading = false;
  }

  selectEmployee(eid: string): void {
    this.routesService.redirectToEmployeeEmployDetail(eid);
  }

  search(): void {
    this.dataSource.filter = JSON.stringify({
      column: this.searchTargetColumn,
      query: this.searchQuery,
    });
  }
}

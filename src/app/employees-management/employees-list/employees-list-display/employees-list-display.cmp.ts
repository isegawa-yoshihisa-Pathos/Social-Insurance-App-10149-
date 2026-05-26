import { Component, inject, Input, ViewChild } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RoutesService } from '../../../routes.service';

interface EmployeeDoc {
  eid: string;
  displayName: string;
  role: 'admin' | 'member';
  status: string;
}

@Component({
  selector: 'app-employees-list-display',
  imports: [MatTableModule, MatSortModule],
  templateUrl: './employees-list-display.cmp.html',
  styleUrl: './employees-list-display.cmp.css',
})
export class EmployeesListDisplayCmp {
  private readonly firestore = inject(Firestore);
  private readonly routesService = inject(RoutesService);

  @Input() tid = '';

  @ViewChild(MatSort) set matSort(sort: MatSort) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  dataSource = new MatTableDataSource<EmployeeDoc>([]);
  displayedColumns = ['displayName', 'role', 'status'];

  loading = true;

  async ngOnInit(): Promise<void> {
    this.loading = true;
    if (!this.tid) {
      this.loading = false;
      return;
    }

    const employeesRef = collection(this.firestore, 'tenants', this.tid, 'employees');
    const employees = await getDocs(employeesRef);

    const data = employees.docs.map((doc) => ({
      eid: doc.id,
      ...(doc.data() as Omit<EmployeeDoc, 'eid'>),
    }));

    this.dataSource.data = data;

    this.loading = false;
  }

  selectEmployee(eid: string): void {
    this.routesService.redirectToEmployeeDetail(eid);
  }
}

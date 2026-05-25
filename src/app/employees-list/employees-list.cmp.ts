import { Component, inject, Input, ViewChild } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

interface EmployeeDoc {
  displayName: string;
  role: 'admin' | 'member';
  status: string;
}

@Component({
  selector: 'app-employees-list',
  imports: [MatTableModule, MatSortModule],
  templateUrl: './employees-list.cmp.html',
  styleUrl: './employees-list.cmp.css',
})
export class EmployeesListCmp {
  private readonly firestore = inject(Firestore);

  @Input() eid = '';

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
    if (!this.eid) {
      this.loading = false;
      return;
    }

    const employeesRef = collection(this.firestore, 'tenants', this.eid, 'employees');
    const employees = await getDocs(employeesRef);

    const data = employees.docs.map((doc) => doc.data() as EmployeeDoc);

    this.dataSource.data = data;

    this.loading = false;
  }
}

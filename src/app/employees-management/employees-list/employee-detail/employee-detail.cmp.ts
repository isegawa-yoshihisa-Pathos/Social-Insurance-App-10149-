import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EmployeeDetailDataService } from './employee-detail-data.service';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';
import { EmployeeLookupEntry } from '../employee-list-data.util';
import { EmployeeDocument } from '../../../employee-document';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { CurrentTenantService } from '../../../current-tenant.service';

type EmployeeDetailTab = 'employ' | 'status' | 'personal';

@Component({
  selector: 'app-employee-detail',
  imports: [
    MatTabsModule,
    MatProgressSpinnerModule,
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './employee-detail.cmp.html',
  styleUrls: ['./employee-detail.cmp.css', '../../../personal-setting/personal-setting.cmp.css'],
})
export class EmployeeDetailCmp {
  readonly dataService = inject(EmployeeDetailDataService);
  private readonly firestore = inject(Firestore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);
  private readonly currentTenantService = inject(CurrentTenantService);

  private loadToken = 0;
  private employeesLoadedTid: string | null = null;

  readonly eid = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('eid'))),
    { initialValue: null },
  );

  readonly employeeName = signal('');
  readonly employeeId = signal('');
  readonly employees = signal<EmployeeLookupEntry[]>([]);
  readonly loading = signal(true);

  isActive: EmployeeDetailTab = 'employ';

  constructor() {
    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));

    effect(() => {
      const tid = this.currentTenantService.currentTid();
      const eid = this.eid();
      if (!tid || !eid) {
        this.employeeName.set('');
        this.employeeId.set('');
        this.employees.set([]);
        this.employeesLoadedTid = null;
        this.loading.set(false);
        return;
      }

      const token = ++this.loadToken;
      void this.loadForEmployee(tid, eid, token);
    });
  }

  private async loadForEmployee(tid: string, eid: string, token: number): Promise<void> {
    this.loading.set(true);
    try {
      if (this.employeesLoadedTid !== tid) {
        const lookup = await this.loadEmployees(tid);
        if (token !== this.loadToken) return;
        this.employees.set(this.sortEmployees([...lookup.values()]));
        this.employeesLoadedTid = tid;
      }

      await this.dataService.load(eid);
      if (token !== this.loadToken) return;

      const entry = this.employees().find((employee) => employee.eid === eid);
      this.employeeName.set(
        entry?.displayName || this.dataService.personalForm.displayName || '',
      );
      this.employeeId.set(entry?.employeeId || this.dataService.employForm.employeeId || '');
    } catch (error) {
      if (token !== this.loadToken) return;
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
      this.routesService.redirectToEmployeesManagement();
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  private async loadEmployees(tid: string): Promise<Map<string, EmployeeLookupEntry>> {
    const employeesRef = collection(this.firestore, 'tenants', tid, 'employees');
    const employees = await getDocs(employeesRef);
    const lookup = new Map<string, EmployeeLookupEntry>();
    for (const snap of employees.docs) {
      const data = snap.data() as Partial<EmployeeDocument>;
      lookup.set(snap.id, {
        uid: data.uid ?? '',
        eid: snap.id,
        employeeId: data.employeeEmployInfo?.employeeId ?? '',
        displayName: data.employeePersonalInfo?.displayName ?? '',
      });
    }
    return lookup;
  }

  private sortEmployees(employees: EmployeeLookupEntry[]): EmployeeLookupEntry[] {
    return employees.sort((a, b) => {
      const nameCompare = a.displayName.localeCompare(b.displayName, 'ja');
      if (nameCompare !== 0) return nameCompare;
      return a.employeeId.localeCompare(b.employeeId, 'ja');
    });
  }

  private updateTabActive(url: string): void {
    if (url.includes('/personal')) {
      this.isActive = 'personal';
      return;
    }
    if (url.includes('/status')) {
      this.isActive = 'status';
      return;
    }
    this.isActive = 'employ';
  }

  redirectToEmployeesManagement(): void {
    void this.routesService.redirectToEmployeesManagement();
  }

  switchEmployee(nextEid: string): void {
    if (!nextEid || nextEid === this.eid()) return;
    void this.router.navigate(['/employees-management', 'detail', nextEid, this.isActive]);
  }
}

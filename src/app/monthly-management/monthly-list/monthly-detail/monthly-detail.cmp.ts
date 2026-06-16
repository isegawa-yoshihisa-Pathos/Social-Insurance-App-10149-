import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { CurrentTenantService } from '../../../current-tenant.service';
import { MonthlyListDataService, EmployeeLookupEntry } from '../monthly-list-data.service';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';

type MonthlyDetailTab = 'list' | 'standard-remuneration';

@Component({
  selector: 'app-monthly-detail',
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
  templateUrl: './monthly-detail.cmp.html',
  styleUrls: ['./monthly-detail.cmp.css', '../../../personal-setting/personal-setting.cmp.css'],
})
export class MonthlyDetailCmp {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentTenantService = inject(CurrentTenantService);
  private readonly listDataService = inject(MonthlyListDataService);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

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

  isActive: MonthlyDetailTab = 'list';

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
        const employeeLookup = await this.listDataService.loadEmployeeLookup(tid);
        if (token !== this.loadToken) return;
        this.employees.set(this.sortEmployees([...employeeLookup.values()]));
        this.employeesLoadedTid = tid;
      }

      const result = await this.listDataService.loadEmployeeMonthlyHistory(tid, eid);
      if (token !== this.loadToken) return;

      this.employeeName.set(result.displayName);
      this.employeeId.set(result.employeeId);
    } catch (error) {
      if (token !== this.loadToken) return;
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    } finally {
      if (token === this.loadToken) {
        this.loading.set(false);
      }
    }
  }

  private updateTabActive(url: string): void {
    if (url.includes('/standard-remuneration')) {
      this.isActive = 'standard-remuneration';
      return;
    }
    this.isActive = 'list';
  }

  redirectToMonthlyManagement(): void {
    void this.routesService.redirectToMonthlyManagement();
  }

  switchEmployee(nextEid: string): void {
    if (!nextEid || nextEid === this.eid()) return;
    void this.router.navigate(['/monthly-management', 'detail', nextEid, this.isActive]);
  }

  private sortEmployees(employees: EmployeeLookupEntry[]): EmployeeLookupEntry[] {
    return employees.sort((a, b) => {
      const nameCompare = a.displayName.localeCompare(b.displayName, 'ja');
      if (nameCompare !== 0) return nameCompare;
      return a.employeeId.localeCompare(b.employeeId, 'ja');
    });
  }
}

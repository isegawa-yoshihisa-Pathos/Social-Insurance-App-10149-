import { Component, OnInit, inject } from '@angular/core';
import { EmployeeDetailDataService } from './employee-detail-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ErrorDialogCmp, mapFirebaseError } from '../../../error-dialog/error-dialog.cmp';
import { RoutesService } from '../../../routes.service';

@Component({
  selector: 'app-employee-detail',
  imports: [MatTabsModule, MatProgressSpinnerModule, RouterOutlet, RouterLink],
  templateUrl: './employee-detail.cmp.html',
  styleUrls: ['./employee-detail.cmp.css', '../../../personal-setting/personal-setting.cmp.css'],
})
export class EmployeeDetailCmp implements OnInit {
  readonly dataService = inject(EmployeeDetailDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly routesService = inject(RoutesService);

  eid = '';
  isActive = 'employ';

  async ngOnInit(): Promise<void> {
    this.eid = this.route.snapshot.paramMap.get('eid') ?? '';
    if (!this.eid) {
      this.routesService.redirectToEmployeesManagement();
      return;
    }

    try {
      await this.dataService.load(this.eid);
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
      this.routesService.redirectToEmployeesManagement();
      return;
    }

    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isActive = url.includes('/personal') ? 'personal' : url.includes('/status') ? 'status' : 'employ';
  }
}

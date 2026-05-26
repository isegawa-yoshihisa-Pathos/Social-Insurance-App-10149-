import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ErrorDialogCmp, mapFirebaseError } from '../error-dialog/error-dialog.cmp';
import { PersonalSettingDataService } from './personal-setting-data.service';

@Component({
  selector: 'app-personal-setting',
  imports: [MatTabsModule, MatProgressSpinnerModule, RouterLink, RouterOutlet],
  templateUrl: './personal-setting.cmp.html',
  styleUrl: './personal-setting.cmp.css',
})
export class PersonalSettingCmp implements OnInit {
  readonly dataService = inject(PersonalSettingDataService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  isEmployeeActive = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.dataService.loadAll();
    } catch (error) {
      this.dialog.open(ErrorDialogCmp, {
        data: { message: mapFirebaseError(error) },
      });
    }
    this.updateTabActive(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.updateTabActive(e.urlAfterRedirects));
  }

  private updateTabActive(url: string): void {
    this.isEmployeeActive = url.startsWith('/personal-setting/employee');
  }
}
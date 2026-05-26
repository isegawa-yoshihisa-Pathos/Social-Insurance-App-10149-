import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PersonalSettingDataService } from '../personal-setting-data.service';
import { RoutesService } from '../../routes.service';

@Component({
  selector: 'app-employee-info',
  imports: [MatButtonModule],
  templateUrl: './employee-info.cmp.html',
  styleUrls: ['./employee-info.cmp.css', '../personal-setting.cmp.css'],
})
export class EmployeeInfoCmp {
  readonly dataService = inject(PersonalSettingDataService);
  private readonly routesService = inject(RoutesService);

  edit(): void {
    this.routesService.redirectToEmployeeSettingEdit();
  }
}
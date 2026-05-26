import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PersonalSettingDataService } from '../personal-setting-data.service';
import { RoutesService } from '../../routes.service';
@Component({
  selector: 'app-personal-info',
  imports: [MatButtonModule],
  templateUrl: './personal-info.cmp.html',
  styleUrl: './personal-info.cmp.css',
})
export class PersonalInfoCmp {
  readonly dataService = inject(PersonalSettingDataService);
  private readonly routesService = inject(RoutesService);
  edit(): void {
    this.routesService.redirectToPersonalSettingEdit();
  }
}
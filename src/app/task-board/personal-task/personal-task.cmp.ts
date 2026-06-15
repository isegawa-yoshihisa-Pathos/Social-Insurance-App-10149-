import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RoutesService } from '../../routes.service';

@Component({
  selector: 'app-personal-task',
  imports: [MatButtonModule],
  templateUrl: './personal-task.cmp.html',
  styleUrl: './personal-task.cmp.css',
})
export class PersonalTaskCmp {
  readonly routesService = inject(RoutesService);

  navigateToAllowanceApplication(): void {
    this.routesService.redirectToAllowanceApplication();
  }

  navigateToLeaveApplication(): void {
    this.routesService.redirectToLeaveApplication();
  }

  navigateToResignApplication(): void {
    this.routesService.redirectToResignApplication();
  }
}

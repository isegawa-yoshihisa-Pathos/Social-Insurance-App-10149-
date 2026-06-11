import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TenantTaskCmp } from './tenant-task/tenant-task.cmp';
import { PersonalTaskCmp } from './personal-task/personal-task.cmp';
import { ApplicationListCmp } from './application-list/application-list.cmp';
import { CurrentTenantService } from '../current-tenant.service';

@Component({
  selector: 'app-task-board',
  imports: [TenantTaskCmp, PersonalTaskCmp, RouterOutlet, ApplicationListCmp],
  templateUrl: './task-board.cmp.html',
  styleUrl: './task-board.cmp.css',
})
export class TaskBoardCmp {
  readonly tenant = inject(CurrentTenantService);

  readonly isAdmin = this.tenant.isAdmin();
}

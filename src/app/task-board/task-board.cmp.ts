import { Component, inject } from '@angular/core';
import { TenantTaskCmp } from './tenant-task/tenant-task.cmp';
import { PersonalTaskCmp } from './personal-task/personal-task.cmp';
import { CurrentTenantService } from '../current-tenant.service';

@Component({
  selector: 'app-task-board',
  imports: [TenantTaskCmp, PersonalTaskCmp],
  templateUrl: './task-board.cmp.html',
  styleUrl: './task-board.cmp.css',
})
export class TaskBoardCmp {
  readonly tenant = inject(CurrentTenantService);

  readonly isAdmin = this.tenant.isAdmin();
}

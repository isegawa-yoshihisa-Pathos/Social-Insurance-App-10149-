import { Component } from '@angular/core';
import { TenantTaskCmp } from '../tenant-task/tenant-task.cmp';

@Component({
  selector: 'app-task-board-tenant',
  imports: [TenantTaskCmp],
  templateUrl: './task-board-tenant.cmp.html',
  styleUrl: './task-board-tenant.cmp.css',
})
export class TaskBoardTenantCmp {}

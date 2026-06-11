import { Component } from '@angular/core';
import { AcceptApplicationCmp } from './accept-application/accept-application.cmp';

@Component({
  selector: 'app-tenant-task',
  imports: [AcceptApplicationCmp],
  templateUrl: './tenant-task.cmp.html',
  styleUrl: './tenant-task.cmp.css',
})
export class TenantTaskCmp {}

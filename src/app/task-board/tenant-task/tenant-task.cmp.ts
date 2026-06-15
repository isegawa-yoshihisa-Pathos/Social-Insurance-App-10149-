import { Component } from '@angular/core';
import { AcceptApplicationCmp } from './accept-application/accept-application.cmp';
import { MayJuneZuijiReviewCmp } from './may-june-zuiji-review/may-june-zuiji-review.cmp';
import { RemunerationConsentReviewCmp } from './remuneration-consent-review/remuneration-consent-review.cmp';
import { TeijiNonTargetAlertCmp } from './teiji-non-target-alert/teiji-non-target-alert.cmp';
import { StandardZuijiAlertCmp } from './standard-zuiji-alert/standard-zuiji-alert.cmp';

@Component({
  selector: 'app-tenant-task',
  imports: [
    AcceptApplicationCmp,
    MayJuneZuijiReviewCmp,
    RemunerationConsentReviewCmp,
    TeijiNonTargetAlertCmp,
    StandardZuijiAlertCmp,
  ],
  templateUrl: './tenant-task.cmp.html',
  styleUrl: './tenant-task.cmp.css',
})
export class TenantTaskCmp {}

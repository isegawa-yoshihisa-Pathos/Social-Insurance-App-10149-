import { inject } from '@angular/core';
import { CurrentTenantService } from './current-tenant.service';
import { ProfileCompletionService } from './profile-completion.service';
import { ResolveFn } from '@angular/router';
import { AuthService } from './auth.service';

export const profileCompletionResolver: ResolveFn<void> = async () => {
  const authService = inject(AuthService);
  const tenant = inject(CurrentTenantService);
  const profile = inject(ProfileCompletionService);

  const uid = authService.uid();
  if (!uid) return;

  const tid = tenant.currentTid();
  if (!tid) return;

  await profile.refresh(uid, tid);
};

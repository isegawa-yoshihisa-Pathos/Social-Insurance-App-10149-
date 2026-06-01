import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CurrentTenantService } from './current-tenant.service';

export const rootRedirectGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const tenant = inject(CurrentTenantService);
  const router = inject(Router);

  await authService.whenReady();

  if (authService.uid() && tenant.currentTid()) {
    return router.createUrlTree(['/main-page']);
  }
  return router.createUrlTree(['/home']);
};
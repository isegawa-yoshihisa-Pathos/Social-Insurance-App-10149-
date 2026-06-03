import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { CurrentTenantService } from './current-tenant.service';
import { Router } from '@angular/router';

export const multipleTenantGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const tenant = inject(CurrentTenantService);
  const router = inject(Router);

  await authService.whenReady();
  const uid = authService.uid();
  if (!uid) return router.createUrlTree(['/home']);

  if (tenant.affiliations().length === 1) return router.createUrlTree(['/personal-setting/employee']);
  return true;
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentTenantService } from '../../current-tenant.service';

export const taskBoardTenantGuard: CanActivateFn = () => {
  const tenant = inject(CurrentTenantService);
  const router = inject(Router);

  if (!tenant.currentTid()) {
    return router.createUrlTree(['/home']);
  }
  return tenant.isAdmin()
    ? true
    : router.createUrlTree(['/task-board', 'personal']);
};

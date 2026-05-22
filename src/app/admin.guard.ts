import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { CurrentTenantService } from './current-tenant.service';
import { AffiliationDocument } from './document-interfaces';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);
  const currentTenantService = inject(CurrentTenantService);

  const user = await firstValueFrom(authState(auth).pipe(take(1)));
  if (!user) {
    return router.createUrlTree(['/home']);
  }

  if (currentTenantService.getAffiliations().length === 0) {
    await currentTenantService.initialize(user.uid);
  }

  const eid = currentTenantService.getTenant();
  if (!eid) {
    return router.createUrlTree(['/home']);
  }

  const affiliationRef = doc(firestore, 'affiliations', `${user.uid}_${eid}`);
  const affiliationSnap = await getDoc(affiliationRef);

  if (!affiliationSnap.exists()) {
    return router.createUrlTree(['/home']);
  }

  const affiliation = affiliationSnap.data() as AffiliationDocument;
  if (affiliation['role'] === 'admin' && affiliation['status'] === 'active') {
    return true;
  }
  return router.createUrlTree(['/home']);
};
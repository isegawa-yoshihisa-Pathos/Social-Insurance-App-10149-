import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { CurrentEstablishmentService } from './current-establishment.service';
import { AffiliationDocument } from './document-interfaces';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);
  const currentEstService = inject(CurrentEstablishmentService);

  const user = await firstValueFrom(authState(auth).pipe(take(1)));
  if (!user) {
    return router.createUrlTree(['/home']);
  }

  if (currentEstService.getAffiliations().length === 0) {
    await currentEstService.initialize(user.uid);
  }

  const eid = currentEstService.getEstablishment();
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
import { inject, 
  ApplicationConfig, 
  provideBrowserGlobalErrorListeners, 
  provideZoneChangeDetection, 
  provideAppInitializer,
  LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { getAuth, provideAuth, Auth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { firstValueFrom, take } from 'rxjs';
import { authState } from '@angular/fire/auth';
import { routes } from './app.routes';
import { CurrentTenantService } from './current-tenant.service';
import { provideNativeDateAdapter } from '@angular/material/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideFunctions(() => getFunctions(undefined, 'asia-northeast1')),
    provideAppInitializer(async () => {
      const auth = inject(Auth);
      const tenant = inject(CurrentTenantService);
      const user = await firstValueFrom(authState(auth).pipe(take(1)));
      if (user) {
        await tenant.bootstrap(user.uid);
      }
    }),
    provideNativeDateAdapter(),
    { provide: LOCALE_ID, useValue: 'ja-JP' },
  ],
};

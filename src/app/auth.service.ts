import { Injectable, signal, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { authState } from '@angular/fire/auth';
import { firstValueFrom, take, filter } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);

  readonly uid = signal<string | null>(null);
  readonly email = signal<string | null>(null);
  private readonly ready = signal(false);

  constructor() {
    authState(this.auth).subscribe((user) => {
      this.uid.set(user?.uid ?? null);
      this.email.set(user?.email ?? null);
      this.ready.set(true);
    });
  }

  whenReady(): Promise<void> {
    if (this.ready()) return Promise.resolve();
    return firstValueFrom(
      toObservable(this.ready).pipe(filter(Boolean), take(1)),
    ).then(() => {});
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const user = credential.user;
    if (user) {
      this.uid.set(user.uid);
      this.email.set(user.email);
    }
    return user?.uid ?? null;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.uid.set(null);
    this.email.set(null);
    this.ready.set(false);
  }
}

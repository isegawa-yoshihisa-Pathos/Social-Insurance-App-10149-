import { Injectable, signal, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);

  readonly userId = signal<string | null>(null);
  readonly authEmail = signal<string | null>(null);

  constructor() {}

  async signIn(email: string, password: string): Promise<string | null> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const user = credential.user;
    if (user) {
      this.userId.set(user.uid);
      this.authEmail.set(user.email);
    }
    return user?.uid ?? null;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
    this.userId.set(null);
    this.authEmail.set(null);
  }
}

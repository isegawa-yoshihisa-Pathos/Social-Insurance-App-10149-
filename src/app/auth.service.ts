import { Injectable, signal, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Firestore } from '@angular/fire/firestore';
import { Storage } from '@angular/fire/storage';
import { MatDialog } from '@angular/material/dialog';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly dialog = inject(MatDialog);

  readonly userId = signal<string | null>(null);
  readonly userName = signal<string | null>(null);
  readonly authEmail = signal<string | null>(null);
  readonly role = signal<string | null>(null);

  constructor() {}

  async signUp(emailRaw: string, userNameRaw: string, password: string): Promise<void> {
    const email = emailRaw;
    const userName = userNameRaw;
    await createUserWithEmailAndPassword(this.auth, email, password);
  }
}

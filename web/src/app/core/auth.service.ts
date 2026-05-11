import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  loading = signal(true);

  constructor() {
    onAuthStateChanged(auth, async (user) => {
      if (!user && !environment.production && environment.bypassAuth) {
        try {
          await signInAnonymously(auth);
          return; // onAuthStateChanged dispara novamente
        } catch (e) {
          console.error('Bypass anônimo falhou:', e);
        }
      }
      this.currentUser.set(user);
      this.loading.set(false);
    });
  }

  async login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async register(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  async logout() {
    return signOut(auth);
  }
}

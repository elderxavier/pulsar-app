import { Injectable, signal } from '@angular/core';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';
import { environment } from '../../environments/environment';

const FAKE_USER = {
  uid: 'dev-bypass-user',
  email: 'dev@pulsar.local',
  displayName: 'Dev Bypass',
  emailVerified: true,
  isAnonymous: false,
} as unknown as User;

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  loading = signal(true);

  constructor() {
    if (!environment.production && environment.bypassAuth) {
      this.currentUser.set(FAKE_USER);
      this.loading.set(false);
      return;
    }
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user);
      this.loading.set(false);
    });
  }

  async login(email: string, password: string) {
    if (!environment.production && environment.bypassAuth) {
      this.currentUser.set(FAKE_USER);
      return { user: FAKE_USER } as any;
    }
    return signInWithEmailAndPassword(auth, email, password);
  }

  async register(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  async logout() {
    return signOut(auth);
  }
}

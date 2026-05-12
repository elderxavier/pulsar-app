import { Injectable, signal, computed } from '@angular/core';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { fbAuth } from './firebase';
import { environment } from '../../environments/environment';

// Usuário-padrão criado pelo script scripts/create-default-user.js.
// Usado apenas como fallback quando environment.bypassAuth=true em dev.
const DEV_FALLBACK_EMAIL = 'admin@pulsar.app';
const DEV_FALLBACK_PASSWORD = 'Pulsar@2026';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return 'Visitante';
    return u.displayName || (u.email ? u.email.split('@')[0] : 'Anônimo');
  });

  private bootstrapped = false;
  private bypassInFlight = false;

  bootstrap(): void {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    onAuthStateChanged(fbAuth(), async (user) => {
      if (!user && !environment.production && environment.bypassAuth && !this.bypassInFlight) {
        this.bypassInFlight = true;
        try {
          await this.signInDevFallback();
          return; // segundo callback dispara com user populado
        } catch (err) {
          console.error('[Auth] bypass dev falhou', err);
        } finally {
          this.bypassInFlight = false;
        }
      }
      this.user.set(user);
      this.loading.set(false);
    });
  }

  /**
   * Tenta autenticação anônima; se desabilitada no Console
   * (admin-restricted-operation), cai para o usuário-padrão dev.
   */
  private async signInDevFallback(): Promise<void> {
    try {
      await signInAnonymously(fbAuth());
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code !== 'auth/admin-restricted-operation' && code !== 'auth/operation-not-allowed') {
        throw err;
      }
      console.warn('[Auth] anônimo desabilitado no Console; usando usuário-padrão dev');
      await signInWithEmailAndPassword(fbAuth(), DEV_FALLBACK_EMAIL, DEV_FALLBACK_PASSWORD);
    }
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(fbAuth(), email.trim(), password);
  }

  async register(email: string, password: string, displayName?: string) {
    const cred = await createUserWithEmailAndPassword(fbAuth(), email.trim(), password);
    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    return cred;
  }

  loginAnonymous() {
    return signInAnonymously(fbAuth());
  }

  logout() {
    return signOut(fbAuth());
  }
}

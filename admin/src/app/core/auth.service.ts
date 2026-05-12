import { Injectable, signal, computed } from '@angular/core';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { fbAuth, fbDb } from './firebase';

interface AdminClaims {
  admin?: boolean;
  superAdmin?: boolean;
}

/**
 * Fonte de admin é HÍBRIDA:
 *   - Custom claim `admin=true` no token (preferida, sem leitura extra)
 *   - OU doc em `/admins/{uid}` com `{ admin: true, superAdmin?: boolean }`
 *
 * O segundo path permite bootstrapar o primeiro admin via Console do Firebase
 * antes de ter uma service account. Depois que você baixar a chave e rodar
 * `set-admin-claim.js`, a claim vira o single source of truth — mantenha
 * o doc apenas como bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly claims = signal<AdminClaims>({});
  readonly loading = signal(true);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.claims().admin === true);
  readonly isSuperAdmin = computed(() => this.claims().superAdmin === true);
  readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '—';
    return u.displayName || (u.email ? u.email.split('@')[0] : 'admin');
  });

  private bootstrapped = false;

  bootstrap(): void {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    onAuthStateChanged(fbAuth(), async (user) => {
      this.user.set(user);
      if (user) {
        this.claims.set(await this.resolveClaims(user));
      } else {
        this.claims.set({});
      }
      this.loading.set(false);
    });
  }

  /** Tenta autenticar e valida que o usuário tem admin (claim OU doc). */
  async login(email: string, password: string): Promise<{ admin: boolean; superAdmin: boolean }> {
    const cred = await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
    const claims = await this.resolveClaims(cred.user);
    if (!claims.admin) {
      await signOut(fbAuth());
      throw new Error('Esta conta não tem privilégios de admin.');
    }
    this.claims.set(claims);
    return { admin: true, superAdmin: !!claims.superAdmin };
  }

  async refreshClaims(): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.claims.set(await this.resolveClaims(u));
  }

  logout() {
    return signOut(fbAuth());
  }

  /** Lê claim no token e, se ausente, faz fallback para /admins/{uid}. */
  private async resolveClaims(user: User): Promise<AdminClaims> {
    let admin = false;
    let superAdmin = false;
    try {
      const token = await user.getIdTokenResult(true);
      admin = token.claims['admin'] === true;
      superAdmin = token.claims['superAdmin'] === true;
    } catch (err) {
      console.error('[Auth] falha ao ler claims', err);
    }
    if (!admin) {
      try {
        const snap = await getDoc(doc(fbDb(), 'admins', user.uid));
        if (snap.exists()) {
          const data = snap.data() as { admin?: boolean; superAdmin?: boolean };
          admin = data.admin === true;
          superAdmin = superAdmin || data.superAdmin === true;
        }
      } catch (err) {
        // Sem permissão = não é admin. Apenas log em debug.
        console.debug('[Auth] sem doc /admins:', (err as any)?.code ?? err);
      }
    }
    return { admin, superAdmin };
  }
}

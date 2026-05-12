import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  getDocs,
  limit,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuditService } from './audit.service';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  /** Sinalizado para banimento (lido pelas regras do client app) */
  banned: boolean;
  bannedReason?: string;
  bannedAt?: Timestamp;
  /** Promovido a admin via doc (claim será setada via Cloud Function ou script) */
  adminRequested?: boolean;
  postsCount?: number;
  lastSeenAt?: Timestamp;
  createdAt?: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  private audit = inject(AuditService);

  /**
   * Stream de /users (espera-se que o app principal já mantenha esse perfil
   * — para MVP, esse serviço aceita usuários "sintetizados" da coleção posts).
   */
  listenAll(callback: (users: AdminUser[]) => void, lim = 500): Unsubscribe {
    const q = query(collection(fbDb(), 'users'), orderBy('createdAt', 'desc'), limit(lim));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    }, async (err) => {
      console.warn('[UsersAdmin] /users não disponível, sintetizando de posts', err);
      callback(await this.synthesizeFromPosts(lim));
    });
  }

  async banUser(uid: string, reason: string): Promise<void> {
    await setDoc(doc(fbDb(), 'users', uid), {
      banned: true,
      bannedReason: reason,
      bannedAt: Timestamp.now(),
    }, { merge: true });
    await this.audit.log({ action: 'user.ban', target: uid, reason });
  }

  async unbanUser(uid: string): Promise<void> {
    await updateDoc(doc(fbDb(), 'users', uid), {
      banned: false,
      bannedReason: '',
      bannedAt: null,
    });
    await this.audit.log({ action: 'user.unban', target: uid });
  }

  /**
   * Marca usuário como candidato a admin. A claim real é aplicada via
   * `scripts/set-admin-claim.js` (Firebase Admin SDK) ou Cloud Function.
   */
  async requestPromote(uid: string): Promise<void> {
    await setDoc(doc(fbDb(), 'users', uid), {
      adminRequested: true,
      adminRequestedAt: Timestamp.now(),
    }, { merge: true });
    await this.audit.log({ action: 'user.promote_request', target: uid });
  }

  async revokeAdmin(uid: string): Promise<void> {
    await updateDoc(doc(fbDb(), 'users', uid), {
      adminRequested: false,
    });
    await this.audit.log({ action: 'user.revoke_admin', target: uid });
  }

  /**
   * Fallback: cria lista de usuários a partir da coleção posts
   * agrupando por userId. Útil quando ainda não há coleção /users.
   */
  private async synthesizeFromPosts(lim: number): Promise<AdminUser[]> {
    const snap = await getDocs(query(
      collection(fbDb(), 'posts'),
      orderBy('createdAt', 'desc'),
      limit(lim * 4),
    ));
    const map = new Map<string, AdminUser>();
    for (const d of snap.docs) {
      const data: any = d.data();
      const uid = data.userId;
      if (!uid) continue;
      const ex = map.get(uid);
      if (ex) {
        ex.postsCount = (ex.postsCount ?? 0) + 1;
        if (data.createdAt?.toMillis?.() > (ex.lastSeenAt?.toMillis?.() ?? 0)) {
          ex.lastSeenAt = data.createdAt;
        }
      } else {
        map.set(uid, {
          uid,
          email: '',
          displayName: data.userName ?? 'Anônimo',
          banned: false,
          postsCount: 1,
          lastSeenAt: data.createdAt,
        });
      }
    }
    return Array.from(map.values()).slice(0, lim);
  }

  private fromDoc(uid: string, data: any): AdminUser {
    return {
      uid,
      email: data.email ?? '',
      displayName: data.displayName ?? data.userName ?? 'Anônimo',
      photoURL: data.photoURL ?? '',
      banned: data.banned === true,
      bannedReason: data.bannedReason ?? '',
      bannedAt: data.bannedAt ?? undefined,
      adminRequested: data.adminRequested === true,
      postsCount: data.postsCount ?? 0,
      lastSeenAt: data.lastSeenAt ?? undefined,
      createdAt: data.createdAt ?? undefined,
    };
  }
}

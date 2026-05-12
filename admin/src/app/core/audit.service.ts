import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  limit,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuthService } from './auth.service';

export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  target: string;
  reason?: string;
  createdAt: Timestamp;
}

interface LogInput {
  action: string;
  target: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private auth = inject(AuthService);

  async log(entry: LogInput): Promise<void> {
    try {
      const u = this.auth.user();
      await addDoc(collection(fbDb(), 'audit'), {
        action: entry.action,
        actorId: u?.uid ?? 'system',
        actorName: u?.displayName ?? u?.email ?? 'system',
        target: entry.target,
        reason: entry.reason ?? '',
        createdAt: Timestamp.now(),
      });
    } catch (err) {
      // Audit log nunca deve quebrar a ação principal
      console.error('[Audit] falha ao registrar', entry, err);
    }
  }

  listenRecent(callback: (entries: AuditEntry[]) => void, lim = 200): Unsubscribe {
    const q = query(
      collection(fbDb(), 'audit'),
      orderBy('createdAt', 'desc'),
      limit(lim),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    }, (err) => console.error('[Audit] listen', err));
  }

  listenByActor(actorId: string, callback: (entries: AuditEntry[]) => void): Unsubscribe {
    const q = query(
      collection(fbDb(), 'audit'),
      where('actorId', '==', actorId),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    });
  }

  private fromDoc(id: string, data: any): AuditEntry {
    return {
      id,
      action: data.action ?? '',
      actorId: data.actorId ?? '',
      actorName: data.actorName ?? 'desconhecido',
      target: data.target ?? '',
      reason: data.reason ?? '',
      createdAt: data.createdAt ?? Timestamp.now(),
    };
  }
}

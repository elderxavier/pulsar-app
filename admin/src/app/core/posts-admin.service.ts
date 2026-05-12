import { Injectable } from '@angular/core';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
  startAfter,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  where,
  QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuditService } from './audit.service';
import { inject } from '@angular/core';

export interface AdminPost {
  id: string;
  title: string;
  content: string;
  latitude: number;
  longitude: number;
  userId: string;
  userName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  imageUrl: string;
  videoUrl: string;
  /** Flag de moderação (preenchido só para posts já flaggados) */
  flagged?: boolean;
  flagReason?: string;
}

export type PostFilter = 'all' | 'active' | 'expired' | 'flagged';

@Injectable({ providedIn: 'root' })
export class AdminPostsService {
  private audit = inject(AuditService);

  /** Stream em tempo real (limite alto para console admin). */
  listenAll(callback: (posts: AdminPost[]) => void, lim = 500): Unsubscribe {
    const q = query(collection(fbDb(), 'posts'), orderBy('createdAt', 'desc'), limit(lim));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
    }, (err) => console.error('[AdminPosts] listen', err));
  }

  /** Página paginada (cursor). Usar p/ listas grandes sem realtime. */
  async fetchPage(pageSize = 50, after?: QueryDocumentSnapshot): Promise<{ posts: AdminPost[]; last?: QueryDocumentSnapshot }> {
    const baseQ = query(
      collection(fbDb(), 'posts'),
      orderBy('createdAt', 'desc'),
      ...(after ? [startAfter(after)] : []),
      limit(pageSize),
    );
    const snap = await getDocs(baseQ);
    return {
      posts: snap.docs.map((d) => this.fromDoc(d.id, d.data())),
      last: snap.docs[snap.docs.length - 1],
    };
  }

  async deletePost(postId: string, reason: string): Promise<void> {
    await deleteDoc(doc(fbDb(), 'posts', postId));
    await this.audit.log({
      action: 'post.delete',
      target: postId,
      reason,
    });
  }

  async forceExpire(postId: string): Promise<void> {
    await updateDoc(doc(fbDb(), 'posts', postId), {
      expiresAt: Timestamp.now(),
    });
    await this.audit.log({ action: 'post.force_expire', target: postId });
  }

  async flagPost(postId: string, reason: string): Promise<void> {
    await updateDoc(doc(fbDb(), 'posts', postId), {
      flagged: true,
      flagReason: reason,
      flaggedAt: Timestamp.now(),
    });
    await this.audit.log({ action: 'post.flag', target: postId, reason });
  }

  async unflagPost(postId: string): Promise<void> {
    await updateDoc(doc(fbDb(), 'posts', postId), {
      flagged: false,
      flagReason: '',
    });
    await this.audit.log({ action: 'post.unflag', target: postId });
  }

  /** Conta posts ativos no momento (one-shot, sem stream). */
  async countActive(): Promise<number> {
    const now = Timestamp.now();
    const snap = await getDocs(query(
      collection(fbDb(), 'posts'),
      where('expiresAt', '>', now),
    ));
    return snap.size;
  }

  private fromDoc(id: string, data: any): AdminPost {
    return {
      id,
      title: data.title ?? '',
      content: data.content ?? '',
      latitude: Number(data.latitude ?? data.geopoint?.latitude ?? 0),
      longitude: Number(data.longitude ?? data.geopoint?.longitude ?? 0),
      userId: data.userId ?? '',
      userName: data.userName ?? 'Anônimo',
      createdAt: data.createdAt ?? Timestamp.now(),
      expiresAt: data.expiresAt ?? Timestamp.now(),
      imageUrl: data.imageUrl ?? '',
      videoUrl: data.videoUrl ?? '',
      flagged: data.flagged === true,
      flagReason: data.flagReason ?? '',
    };
  }
}

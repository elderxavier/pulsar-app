import { Injectable, inject } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  GeoPoint,
  limit,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuthService } from './auth.service';

export interface Post {
  id: string;
  title: string;
  content: string;
  latitude: number;
  longitude: number;
  userId: string;
  userName: string;
  createdAt: Timestamp;
  startsAt: Timestamp;
  expiresAt: Timestamp;
  imageUrl: string;
  videoUrl: string;
}

export interface CreatePostInput {
  title: string;
  content: string;
  latitude: number;
  longitude: number;
  startsAt: Date;
  expiresAt: Date;
  imageUrl?: string;
  videoUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PostsService {
  private auth = inject(AuthService);

  /**
   * Escuta posts ativos (expiresAt > now). Faz fallback para
   * filtragem cliente caso a query indexada falhe (regras/índice).
   */
  listenActivePosts(callback: (posts: Post[]) => void, onError?: (e: Error) => void): Unsubscribe {
    const now = Timestamp.now();
    const ref = collection(fbDb(), 'posts');
    const q = query(ref, where('expiresAt', '>', now), orderBy('expiresAt', 'desc'));

    let active = true;
    let fallback: Unsubscribe | null = null;

    const primary = onSnapshot(
      q,
      (snap) => {
        if (!active) return;
        callback(snap.docs.map((d) => this.fromDoc(d.id, d.data())));
      },
      (err) => {
        console.warn('[Posts] query primária falhou, ativando fallback', err);
        fallback = this.listenWithClientFilter(callback);
        onError?.(err as Error);
      }
    );

    return () => {
      active = false;
      primary();
      fallback?.();
    };
  }

  private listenWithClientFilter(callback: (posts: Post[]) => void): Unsubscribe {
    const ref = collection(fbDb(), 'posts');
    const q = query(ref, orderBy('expiresAt', 'desc'), limit(300));
    return onSnapshot(q, (snap) => {
      const now = Date.now();
      callback(
        snap.docs
          .map((d) => this.fromDoc(d.id, d.data()))
          .filter((p) => p.expiresAt.toMillis() > now)
      );
    });
  }

  async createPost(input: CreatePostInput): Promise<string> {
    const user = this.auth.user();
    if (!user) throw new Error('Usuário não autenticado.');
    if (!input.content.trim()) throw new Error('Conteúdo obrigatório.');
    if (input.content.length > 280) throw new Error('Máximo 280 caracteres.');

    const now = Timestamp.now();
    const durationMs = Math.max(
      input.expiresAt.getTime() - input.startsAt.getTime(),
      60 * 60_000 // mínimo 1h
    );

    const ref = await addDoc(collection(fbDb(), 'posts'), {
      title: input.title.trim().slice(0, 100),
      content: input.content.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      geopoint: new GeoPoint(input.latitude, input.longitude),
      userId: user.uid,
      userName: this.auth.displayName(),
      createdAt: now,
      startsAt: now,
      expiresAt: Timestamp.fromMillis(now.toMillis() + durationMs),
      imageUrl: input.imageUrl ?? '',
      videoUrl: input.videoUrl ?? '',
    });

    return ref.id;
  }

  async updatePost(postId: string, patch: { title?: string; content?: string }): Promise<void> {
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data['title'] = patch.title.trim().slice(0, 100);
    if (patch.content !== undefined) {
      const c = patch.content.trim();
      if (!c) throw new Error('Conteúdo obrigatório.');
      if (c.length > 280) throw new Error('Máximo 280 caracteres.');
      data['content'] = c;
    }
    if (Object.keys(data).length === 0) return;
    await updateDoc(doc(fbDb(), 'posts', postId), data);
  }

  async deletePost(postId: string): Promise<void> {
    await deleteDoc(doc(fbDb(), 'posts', postId));
  }

  private fromDoc(id: string, data: any): Post {
    return {
      id,
      title: data.title ?? '',
      content: data.content ?? '',
      latitude: Number(data.latitude ?? data.geopoint?.latitude ?? 0),
      longitude: Number(data.longitude ?? data.geopoint?.longitude ?? 0),
      userId: data.userId ?? '',
      userName: data.userName ?? 'Anônimo',
      createdAt: data.createdAt ?? Timestamp.now(),
      startsAt: data.startsAt ?? data.createdAt ?? Timestamp.now(),
      expiresAt: data.expiresAt ?? Timestamp.now(),
      imageUrl: data.imageUrl ?? '',
      videoUrl: data.videoUrl ?? '',
    };
  }
}

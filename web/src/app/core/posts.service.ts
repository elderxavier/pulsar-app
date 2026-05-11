import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  GeoPoint,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';

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
  listenActivePosts(callback: (posts: Post[]) => void): Unsubscribe {
    const now = Timestamp.now();
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const posts = snapshot.docs.map((d) => this.fromDoc(d.id, d.data()));
        callback(posts);
      },
      (err) => {
        console.warn('listenActivePosts (filtered) falhou, usando fallback:', err);
        this.listenWithClientFilter(callback);
      }
    );
  }

  private listenWithClientFilter(callback: (posts: Post[]) => void): Unsubscribe {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('expiresAt', 'desc'), limit(200));
    return onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const posts = snapshot.docs
        .map((d) => this.fromDoc(d.id, d.data()))
        .filter((p) => p.expiresAt.toMillis() > now);
      callback(posts);
    });
  }

  async createPost(input: CreatePostInput): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Usuário não autenticado');

    const now = Timestamp.now();
    const durationMs = Math.max(
      input.expiresAt.getTime() - input.startsAt.getTime(),
      60 * 60 * 1000
    );
    const anchoredExpires = Timestamp.fromMillis(now.toMillis() + durationMs);

    const userName =
      user.displayName ||
      (user.email ? user.email.split('@')[0] : 'Anônimo');

    const data = {
      title: input.title,
      content: input.content,
      latitude: input.latitude,
      longitude: input.longitude,
      geopoint: new GeoPoint(input.latitude, input.longitude),
      userId: user.uid,
      userName,
      createdAt: now,
      startsAt: now,
      expiresAt: anchoredExpires,
      imageUrl: input.imageUrl ?? '',
      videoUrl: input.videoUrl ?? '',
    };

    const ref = await addDoc(collection(db, 'posts'), data);
    return ref.id;
  }

  async updatePost(postId: string, content: string): Promise<void> {
    await updateDoc(doc(db, 'posts', postId), { content });
  }

  async deletePost(postId: string): Promise<void> {
    await deleteDoc(doc(db, 'posts', postId));
  }

  private fromDoc(id: string, data: any): Post {
    return {
      id,
      title: data.title ?? '',
      content: data.content ?? '',
      latitude: data.latitude ?? 0,
      longitude: data.longitude ?? 0,
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

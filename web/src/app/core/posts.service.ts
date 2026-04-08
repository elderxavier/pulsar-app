import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Post {
  id: string;
  content: string;
  latitude: number;
  longitude: number;
  userId: string;
  userName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
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

    return onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Post, 'id'>),
      }));
      callback(posts);
    });
  }
}

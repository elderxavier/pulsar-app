import { Injectable } from '@angular/core';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';

export interface KpiSnapshot {
  activePosts: number;
  expiredPosts: number;
  postsLast24h: number;
  postsLast1h: number;
  flaggedPosts: number;
  openReports: number;
  uniqueAuthors24h: number;
}

export interface TimeSeriesPoint {
  bucket: number; // unix ms (início do bucket)
  count: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  weight: number;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  /** Snapshot KPI one-shot — chamar com intervalo curto (ex: a cada 30s). */
  async snapshot(): Promise<KpiSnapshot> {
    const now = Date.now();
    const ts24h = Timestamp.fromMillis(now - 24 * 3600 * 1000);
    const ts1h = Timestamp.fromMillis(now - 3600 * 1000);
    const nowTs = Timestamp.fromMillis(now);

    const postsCol = collection(fbDb(), 'posts');

    const [active, last24h, last1h, flagged, expired] = await Promise.all([
      getDocs(query(postsCol, where('expiresAt', '>', nowTs))),
      getDocs(query(postsCol, where('createdAt', '>=', ts24h))),
      getDocs(query(postsCol, where('createdAt', '>=', ts1h))),
      getDocs(query(postsCol, where('flagged', '==', true))).catch(() => null),
      getDocs(query(postsCol, where('expiresAt', '<=', nowTs), limit(500))),
    ]);

    let openReports = 0;
    try {
      const reps = await getDocs(query(collection(fbDb(), 'reports'), where('status', '==', 'open')));
      openReports = reps.size;
    } catch { /* coleção pode não existir ainda */ }

    const authors = new Set<string>();
    for (const d of last24h.docs) {
      const uid = (d.data() as any).userId;
      if (uid) authors.add(uid);
    }

    return {
      activePosts: active.size,
      expiredPosts: expired.size,
      postsLast24h: last24h.size,
      postsLast1h: last1h.size,
      flaggedPosts: flagged?.size ?? 0,
      openReports,
      uniqueAuthors24h: authors.size,
    };
  }

  /** Série temporal de posts criados nas últimas N horas, agrupados por hora. */
  async postsTimeSeries(hours = 24): Promise<TimeSeriesPoint[]> {
    const since = Timestamp.fromMillis(Date.now() - hours * 3600 * 1000);
    const snap = await getDocs(query(
      collection(fbDb(), 'posts'),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'asc'),
    ));

    const buckets = new Map<number, number>();
    const bucketMs = 3600 * 1000;
    const startBucket = Math.floor(since.toMillis() / bucketMs) * bucketMs;

    for (let i = 0; i <= hours; i++) {
      buckets.set(startBucket + i * bucketMs, 0);
    }
    for (const d of snap.docs) {
      const t = (d.data() as any).createdAt as Timestamp | undefined;
      if (!t) continue;
      const b = Math.floor(t.toMillis() / bucketMs) * bucketMs;
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([bucket, count]) => ({ bucket, count }));
  }

  /** Coords ativas para heatmap (até `lim` posts ativos). */
  async activeGeoPoints(lim = 500): Promise<GeoPoint[]> {
    const now = Timestamp.now();
    const snap = await getDocs(query(
      collection(fbDb(), 'posts'),
      where('expiresAt', '>', now),
      limit(lim),
    ));
    const out: GeoPoint[] = [];
    for (const d of snap.docs) {
      const data: any = d.data();
      const lat = Number(data.latitude ?? data.geopoint?.latitude);
      const lng = Number(data.longitude ?? data.geopoint?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        out.push({ lat, lng, weight: 1 });
      }
    }
    return out;
  }

  /** Stream contínua do número de posts ativos (para KPIs ao vivo). */
  listenActiveCount(callback: (n: number) => void): Unsubscribe {
    const now = Timestamp.now();
    return onSnapshot(
      query(collection(fbDb(), 'posts'), where('expiresAt', '>', now)),
      (snap) => callback(snap.size),
      (err) => console.error('[Metrics] listenActiveCount', err),
    );
  }
}

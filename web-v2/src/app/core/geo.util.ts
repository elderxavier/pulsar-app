import type { Post } from './posts.service';

const R_EARTH = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversine(a: LatLng, b: { latitude: number; longitude: number }): number {
  const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
  const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}

export function timeRemaining(p: Pick<Post, 'expiresAt'>): string {
  const diff = p.expiresAt.toMillis() - Date.now();
  if (diff <= 0) return 'expirado';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function timeAgo(t: { toMillis(): number }): string {
  const diff = Date.now() - t.toMillis();
  if (diff < 60_000) return 'agora';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function progressPercent(p: Pick<Post, 'startsAt' | 'expiresAt'>): number {
  const total = p.expiresAt.toMillis() - p.startsAt.toMillis();
  const elapsed = Date.now() - p.startsAt.toMillis();
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

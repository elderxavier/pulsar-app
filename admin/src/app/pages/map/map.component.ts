import { Component, OnDestroy, OnInit, inject, signal, computed, effect, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { PostsService, Post } from '../../core/posts.service';
import { Timestamp, Unsubscribe } from 'firebase/firestore';
import * as L from 'leaflet';

type MapType = 'padrao' | 'satelite' | 'relevo';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  auth = inject(AuthService);
  posts$ = inject(PostsService);
  router = inject(Router);

  posts = signal<Post[]>([]);
  userLocation = signal<{ lat: number; lng: number } | null>(null);
  radiusKm = signal(15);
  search = signal('');
  showNearbySheet = signal(false);
  selectedPost = signal<Post | null>(null);
  showImageFull = signal(false);
  mapType = signal<MapType>('padrao');

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private markers: L.Marker[] = [];
  private locMarker?: L.Marker;
  private unsub?: Unsubscribe;

  nearbyPosts = computed(() => {
    const loc = this.userLocation();
    const radius = this.radiusKm() * 1000;
    if (!loc) return [];
    return this.posts()
      .map(p => ({ post: p, dist: distance(loc.lat, loc.lng, p.latitude, p.longitude) }))
      .filter(x => x.dist <= radius)
      .sort((a, b) => a.dist - b.dist);
  });

  filteredNearby = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.nearbyPosts();
    if (!q) return list;
    return list.filter(({ post }) =>
      post.title.toLowerCase().includes(q) ||
      post.content.toLowerCase().includes(q) ||
      post.userName.toLowerCase().includes(q)
    );
  });

  constructor() {
    effect(() => { this.renderMarkers(this.posts()); });
    effect(() => { this.zoomToRadius(this.radiusKm()); });
  }

  ngOnInit() {
    this.unsub = this.posts$.listenActivePosts(p => this.posts.set(p));
  }

  ngAfterViewInit() {
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: false, attributionControl: false }).setView([-23.5505, -46.6333], 13);
    this.applyTileLayer();
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.userLocation.set(loc);
          this.map?.setView([loc.lat, loc.lng], 14);
          this.renderUserMarker(loc);
        },
        err => console.warn('Geolocation:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }

  ngOnDestroy() { this.unsub?.(); this.map?.remove(); }

  setMapType(t: MapType) { this.mapType.set(t); this.applyTileLayer(); }

  private applyTileLayer() {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const sources: Record<MapType, string> = {
      padrao: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      satelite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      relevo: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    };
    this.tileLayer = L.tileLayer(sources[this.mapType()], { maxZoom: 19 }).addTo(this.map);
  }

  private renderUserMarker(loc: { lat: number; lng: number }) {
    if (this.locMarker) this.locMarker.remove();
    const icon = L.divIcon({
      className: '',
      html: '<div class="w-5 h-5 rounded-full bg-[#00FFD1] border-4 border-white shadow-[0_0_20px_rgba(0,255,209,0.8)]"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    this.locMarker = L.marker([loc.lat, loc.lng], { icon }).addTo(this.map!);
  }

  private renderMarkers(posts: Post[]) {
    if (!this.map) return;
    this.markers.forEach(m => m.remove());
    this.markers = [];
    posts.forEach(post => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="relative">
          <div class="w-9 h-9 rounded-full bg-[#0A0A0A]/80 border-2 border-[#00FFD1] flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-[#00FFD1]"></div>
          </div>
          <div class="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#00FFD1]"></div>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });
      const m = L.marker([post.latitude, post.longitude], { icon }).addTo(this.map!);
      m.on('click', () => this.selectedPost.set(post));
      this.markers.push(m);
    });
  }

  private zoomToRadius(km: number) {
    const loc = this.userLocation();
    if (!this.map || !loc) return;
    const dLat = km / 111;
    const dLng = km / (111 * Math.cos(loc.lat * Math.PI / 180));
    this.map.fitBounds([[loc.lat - dLat, loc.lng - dLng], [loc.lat + dLat, loc.lng + dLng]], { padding: [40, 40] });
  }

  centerOnUser() {
    const loc = this.userLocation();
    if (loc && this.map) this.map.setView([loc.lat, loc.lng], 15, { animate: true });
  }

  openPost(p: Post) { this.selectedPost.set(p); this.showNearbySheet.set(false); if (this.map) this.map.setView([p.latitude, p.longitude], 16, { animate: true }); }

  isOwner(p: Post): boolean { return this.auth.currentUser()?.uid === p.userId; }

  async deletePost(p: Post) {
    if (!confirm('Excluir este pulso?')) return;
    await this.posts$.deletePost(p.id);
    this.selectedPost.set(null);
  }

  async logout() { await this.auth.logout(); this.router.navigate(['/login']); }

  ttl(ts: Timestamp): string {
    const diff = ts.toMillis() - Date.now();
    if (diff <= 0) return 'expirado';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  formatDist(m: number): string { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }
}

function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

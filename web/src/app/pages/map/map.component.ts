import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { PostsService, Post } from '../../core/posts.service';

type MapType = 'padrao' | 'satelite' | 'relevo';

const TILE_LAYERS: Record<MapType, { url: string; attribution: string; max: number }> = {
  padrao: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    max: 19,
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    max: 19,
  },
  relevo: {
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    max: 17,
  },
};

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map.component.html',
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  auth = inject(AuthService);
  private postsService = inject(PostsService);
  private router = inject(Router);

  posts = signal<Post[]>([]);
  userLocation = signal<{ lat: number; lng: number } | null>(null);
  radiusKm = signal(15);
  selectedMapType = signal<MapType>('padrao');
  showNearbySheet = signal(false);
  searchQuery = '';
  selectedPost = signal<Post | null>(null);
  editing = signal(false);
  editContent = '';

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private userMarker?: L.CircleMarker;
  private radiusCircle?: L.Circle;
  private markers = new Map<string, L.Marker>();
  private unsub?: Unsubscribe;

  nearbyPosts = computed(() => {
    const loc = this.userLocation();
    if (!loc) return [] as { post: Post; distance: number }[];
    const r = this.radiusKm() * 1000;
    return this.posts()
      .map((post) => ({ post, distance: this.haversine(loc, post) }))
      .filter((x) => x.distance <= r)
      .sort((a, b) => a.distance - b.distance);
  });

  filteredNearby = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.nearbyPosts();
    return this.nearbyPosts().filter(
      ({ post }) =>
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.userName.toLowerCase().includes(q)
    );
  });

  constructor() {
    // Reage a mudanças de tipo de mapa
    effect(() => {
      const t = this.selectedMapType();
      if (this.map) this.applyTileLayer(t);
    });
    // Reage ao raio
    effect(() => {
      const r = this.radiusKm();
      const loc = this.userLocation();
      if (this.map && loc) this.updateRadiusCircle(loc, r);
    });
    // Reage aos posts
    effect(() => {
      const posts = this.posts();
      if (this.map) this.renderMarkers(posts);
    });
  }

  ngOnInit() {
    this.unsub = this.postsService.listenActivePosts((posts) => this.posts.set(posts));
  }

  ngAfterViewInit() {
    this.initMap();
    this.locateUser();
  }

  ngOnDestroy() {
    this.unsub?.();
    this.map?.remove();
  }

  private initMap() {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [-23.55, -46.63],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });
    this.applyTileLayer(this.selectedMapType());
  }

  private applyTileLayer(type: MapType) {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const cfg = TILE_LAYERS[type];
    this.tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.max,
    }).addTo(this.map);
  }

  private locateUser() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userLocation.set(loc);
        if (this.map) {
          this.map.setView([loc.lat, loc.lng], 15);
          this.placeUserMarker(loc);
          this.updateRadiusCircle(loc, this.radiusKm());
        }
      },
      (err) => console.warn('Geolocalização indisponível:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private placeUserMarker(loc: { lat: number; lng: number }) {
    if (!this.map) return;
    this.userMarker?.remove();
    this.userMarker = L.circleMarker([loc.lat, loc.lng], {
      radius: 8,
      color: '#00FFD1',
      weight: 3,
      fillColor: '#1A237E',
      fillOpacity: 1,
    }).addTo(this.map);
  }

  private updateRadiusCircle(loc: { lat: number; lng: number }, km: number) {
    if (!this.map) return;
    this.radiusCircle?.remove();
    this.radiusCircle = L.circle([loc.lat, loc.lng], {
      radius: km * 1000,
      color: '#00FFD1',
      weight: 1,
      fillColor: '#00FFD1',
      fillOpacity: 0.05,
    }).addTo(this.map);
    this.map.fitBounds(this.radiusCircle.getBounds(), { padding: [40, 40] });
  }

  private renderMarkers(posts: Post[]) {
    if (!this.map) return;
    const ids = new Set(posts.map((p) => p.id));
    // Remove marcadores que sumiram
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
    // Cria/atualiza marcadores
    for (const post of posts) {
      let m = this.markers.get(post.id);
      if (!m) {
        const icon = L.divIcon({
          className: 'pulsar-marker',
          html: `<div class="pm-pin"><div class="pm-core"></div></div>`,
          iconSize: [28, 36],
          iconAnchor: [14, 36],
        });
        m = L.marker([post.latitude, post.longitude], { icon }).addTo(this.map!);
        m.on('click', () => this.openPost(post));
        this.markers.set(post.id, m);
      } else {
        m.setLatLng([post.latitude, post.longitude]);
      }
    }
  }

  private haversine(a: { lat: number; lng: number }, b: { latitude: number; longitude: number }): number {
    const R = 6371000;
    const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
    const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.latitude * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  centerOnUser() {
    const loc = this.userLocation();
    if (loc && this.map) this.map.setView([loc.lat, loc.lng], 15);
    else this.locateUser();
  }

  setMapType(t: MapType) {
    this.selectedMapType.set(t);
  }

  setRadius(km: number) {
    this.radiusKm.set(km);
  }

  openPost(post: Post) {
    this.selectedPost.set(post);
    this.editing.set(false);
    this.editContent = post.content;
    if (this.map) {
      this.map.setView([post.latitude, post.longitude], 16);
    }
  }

  closePost() {
    this.selectedPost.set(null);
    this.editing.set(false);
  }

  isOwner(post: Post): boolean {
    return this.auth.currentUser()?.uid === post.userId;
  }

  async saveEdit() {
    const post = this.selectedPost();
    if (!post || !this.editContent.trim()) return;
    try {
      await this.postsService.updatePost(post.id, this.editContent.trim());
      this.editing.set(false);
      this.closePost();
    } catch (e: any) {
      alert('Erro ao editar: ' + (e?.message ?? e));
    }
  }

  async deletePost() {
    const post = this.selectedPost();
    if (!post) return;
    if (!confirm('Excluir este pulso? Esta ação não pode ser desfeita.')) return;
    try {
      await this.postsService.deletePost(post.id);
      this.closePost();
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e?.message ?? e));
    }
  }

  formatDistance(m: number): string {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  timeRemaining(p: Post): string {
    const diff = p.expiresAt.toMillis() - Date.now();
    if (diff <= 0) return 'Expirado';
    const h = Math.floor(diff / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }

  goCreate() {
    this.router.navigate(['/create']);
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  goDashboard() {
    this.router.navigate(['/dashboard']);
  }

  radiusOptions = [5, 10, 15, 25, 50, 100, 150];
  mapTypes: ReadonlyArray<{ k: MapType; l: string }> = [
    { k: 'padrao', l: 'Padrão' },
    { k: 'satelite', l: 'Satélite' },
    { k: 'relevo', l: 'Relevo' },
  ];
}

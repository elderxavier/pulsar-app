import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import { PostsService, type Post } from '../../core/posts.service';
import { AuthService } from '../../core/auth.service';
import { GeoLocationService } from '../../core/geolocation.service';
import { formatDistance, haversine, timeRemaining, type LatLng } from '../../core/geo.util';

type MapType = 'padrao' | 'satelite' | 'relevo' | 'dark';

const TILE_LAYERS: Record<MapType, { url: string; attribution: string; max: number }> = {
  padrao: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    max: 19,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO &copy; OpenStreetMap',
    max: 20,
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
  template: `
    <section class="relative h-[calc(100dvh-3.5rem)] md:h-dvh w-full overflow-hidden bg-[#06070A]">
      <div #mapEl class="absolute inset-0 z-0"></div>

      <!-- Top controls bar — stack vertical no mobile, side-by-side no md+ -->
      <div class="absolute top-3 inset-x-3 z-[400] flex flex-col md:flex-row md:items-start md:justify-between gap-2 pointer-events-none">
        <!-- Stats pill -->
        <button
          (click)="toggleSheet()"
          class="pointer-events-auto self-center md:self-auto glass-strong rounded-full pl-3 pr-4 py-2 flex items-center gap-2.5 hover:border-[#00FFD1]/30 transition-colors min-h-[40px]"
        >
          <span class="brand-dot"></span>
          <span class="text-[12px] font-medium whitespace-nowrap">
            <span class="text-[#00FFD1] font-semibold">{{ nearbyPosts().length }}</span>
            <span class="text-zinc-500"> de </span>
            <span class="text-zinc-300">{{ posts().length }}</span>
            <span class="text-zinc-500"> · {{ radiusKm() }}km</span>
          </span>
          <svg class="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Map type chips: scrollable em mobile, estático no md+ -->
        <div class="pointer-events-auto self-center md:self-auto max-w-full overflow-x-auto no-scrollbar">
          <div class="inline-flex gap-1 glass-strong rounded-full p-1">
            @for (t of mapTypes; track t.k) {
              <button
                (click)="selectedMapType.set(t.k)"
                class="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap min-h-[32px]"
                [class.bg-\[\#00FFD1\]]="selectedMapType() === t.k"
                [class.text-\[\#06070A\]]="selectedMapType() === t.k"
                [class.text-zinc-400]="selectedMapType() !== t.k"
                [class.hover\:text-white]="selectedMapType() !== t.k"
              >
                {{ t.l }}
              </button>
            }
          </div>
        </div>
      </div>

      <!-- FABs (bottom-right) com safe-area -->
      <div class="absolute right-4 bottom-5 z-[400] flex flex-col gap-2.5 safe-pb safe-pr">
        <button
          (click)="centerOnUser()"
          class="w-12 h-12 rounded-full glass-strong flex items-center justify-center hover:border-[#00FFD1]/30 transition-colors"
          aria-label="Centralizar na minha localização"
        >
          <svg class="w-[18px] h-[18px] text-[#00FFD1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          (click)="goCreate()"
          class="md:hidden w-14 h-14 rounded-full bg-[#00FFD1] text-[#06070A] flex items-center justify-center glow-cyan hover:bg-[#00E0B8] active:scale-95 transition-all"
          aria-label="Criar pulso"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14m7-7H5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Geo error banner -->
      @if (geo.error(); as err) {
        <div class="absolute top-24 md:top-16 left-1/2 -translate-x-1/2 z-[400] glass-strong rounded-lg px-3 py-2 flex items-center gap-2 max-w-[calc(100%-2rem)]">
          <svg class="w-3.5 h-3.5 text-[#FFB547] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"/>
          </svg>
          <span class="text-[11.5px] text-zinc-300">{{ err }}</span>
        </div>
      }

      <!-- Nearby Sheet — bottom em mobile, side-panel em md+ -->
      @if (showSheet()) {
        <div class="absolute inset-0 z-[450] bg-black/50 backdrop-blur-sm anim-fade-in md:bg-transparent md:backdrop-blur-0 md:pointer-events-none" (click)="toggleSheet()"></div>
        <aside
          class="absolute z-[460] glass-strong flex flex-col anim-slide-up sheet-compact
                 inset-x-0 bottom-0 rounded-t-3xl max-h-[78dvh]
                 md:inset-y-4 md:left-4 md:right-auto md:bottom-4 md:top-4 md:w-[380px] md:max-h-none md:rounded-2xl md:max-w-[calc(100vw-2rem)]"
        >
          <div class="pt-3 pb-2 flex justify-center md:hidden">
            <div class="w-10 h-1 rounded-full bg-white/15"></div>
          </div>
          <div class="px-5 pt-2 md:pt-5 pb-3">
            <div class="flex items-center justify-between mb-3">
              <div class="min-w-0">
                <h3 class="text-[16px] font-semibold">Pulsos próximos</h3>
                <p class="text-[11.5px] text-zinc-500 mt-0.5">
                  {{ filteredNearby().length }} resultado{{ filteredNearby().length === 1 ? '' : 's' }} em {{ radiusKm() }} km
                </p>
              </div>
              <button (click)="toggleSheet()" class="w-10 h-10 rounded flex items-center justify-center hover:bg-white/[0.05] shrink-0" aria-label="Fechar">
                <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/>
                </svg>
              </button>
            </div>

            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7"/>
                <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
              </svg>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Buscar pulsos…"
                class="w-full h-11 bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg pl-9 pr-3 text-[13px] placeholder:text-zinc-600 outline-none transition-colors"
              />
            </div>

            <div class="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
              @for (km of radiusOptions; track km) {
                <button
                  (click)="radiusKm.set(km)"
                  class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all min-h-[32px]"
                  [class.bg-\[\#00FFD1\]]="radiusKm() === km"
                  [class.text-\[\#06070A\]]="radiusKm() === km"
                  [class.border-\[\#00FFD1\]]="radiusKm() === km"
                  [class.bg-white\/\[0\.03\]]="radiusKm() !== km"
                  [class.text-zinc-400]="radiusKm() !== km"
                  [class.border-white\/\[0\.08\]]="radiusKm() !== km"
                >{{ km }} km</button>
              }
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-5 pb-6 space-y-2 safe-pb">
            @if (filteredNearby().length === 0) {
              <div class="flex flex-col items-center justify-center py-12 text-center">
                <svg class="w-10 h-10 text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <p class="text-[13px] text-zinc-500">
                  @if (!geo.location()) { Aguardando localização… }
                  @else if (searchQuery) { Nenhum resultado para "{{ searchQuery }}" }
                  @else { Nenhum pulso ativo no raio de {{ radiusKm() }} km }
                </p>
              </div>
            }
            @for (item of filteredNearby(); track item.post.id) {
              <button
                (click)="openPost(item.post)"
                class="w-full text-left bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-xl p-3.5 flex items-start gap-3 transition-colors group"
              >
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFD1]/30 to-[#006B58]/30 border border-[#00FFD1]/20 flex items-center justify-center text-[#00FFD1] text-[12px] font-bold shrink-0">
                  {{ item.post.userName[0]?.toUpperCase() ?? '?' }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[#00FFD1] text-[12.5px] font-semibold truncate">{{ item.post.userName }}</span>
                    <span class="text-zinc-600 text-[10.5px]">·</span>
                    <span class="text-zinc-500 text-[10.5px] whitespace-nowrap">{{ timeRem(item.post) }}</span>
                  </div>
                  @if (item.post.title) {
                    <p class="text-white text-[13px] font-medium mt-0.5 truncate">{{ item.post.title }}</p>
                  }
                  <p class="text-zinc-400 text-[12.5px] clamp-2 mt-0.5">{{ item.post.content }}</p>
                </div>
                <span class="shrink-0 text-zinc-500 text-[11px] font-mono">{{ fmtDist(item.distance) }}</span>
              </button>
            }
          </div>
        </aside>
      }

      <!-- Post Detail Sheet -->
      @if (selectedPost(); as p) {
        <div class="absolute inset-0 z-[470] bg-black/55 backdrop-blur-sm anim-fade-in" (click)="closePost()"></div>
        <div
          class="absolute z-[480] glass-strong overflow-y-auto anim-slide-up sheet-compact
                 inset-x-0 bottom-0 rounded-t-3xl max-h-[85dvh]
                 md:inset-y-0 md:left-1/2 md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(520px,calc(100vw-3rem))] md:max-h-[80dvh] md:rounded-2xl"
        >
          <div class="pt-3 pb-2 flex justify-center md:hidden">
            <div class="w-10 h-1 rounded-full bg-white/15"></div>
          </div>
          <div class="px-5 pb-6 md:pt-5 space-y-4 safe-pb">
            <header class="flex items-start gap-3">
              <div class="w-11 h-11 rounded-full bg-gradient-to-br from-[#00FFD1] to-[#006B58] flex items-center justify-center text-[#06070A] font-bold text-[14px] shrink-0">
                {{ p.userName[0]?.toUpperCase() ?? '?' }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[#00FFD1] text-[13px] font-semibold truncate">{{ p.userName }}</span>
                  @if (isOwner(p)) {
                    <span class="text-[9.5px] uppercase tracking-wider text-[#00FFD1] bg-[#00FFD1]/10 border border-[#00FFD1]/20 px-1.5 py-0.5 rounded">você</span>
                  }
                </div>
                <p class="text-zinc-500 text-[11px] mt-0.5 flex items-center gap-1.5">
                  <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/>
                  </svg>
                  expira em {{ timeRem(p) }}
                </p>
              </div>
              <button (click)="closePost()" class="w-10 h-10 -m-2 rounded flex items-center justify-center hover:bg-white/[0.05] shrink-0" aria-label="Fechar">
                <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/>
                </svg>
              </button>
            </header>

            @if (editing()) {
              @if (p.title || editTitle) {
                <input
                  type="text"
                  [(ngModel)]="editTitle"
                  maxlength="100"
                  placeholder="Título"
                  class="w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-2.5 text-[14px] font-semibold outline-none transition-colors"
                />
              }
              <textarea
                [(ngModel)]="editContent"
                maxlength="280"
                rows="5"
                class="w-full bg-[#0B0D12] border border-[#00FFD1] focus:border-[#00FFD1] rounded-lg px-3.5 py-3 text-[14px] outline-none resize-none transition-colors"
              ></textarea>
              <div class="flex gap-2">
                <button (click)="saveEdit()" [disabled]="saving()" class="flex-1 py-3 rounded-lg bg-[#00FFD1] text-[#06070A] font-semibold text-[13px] hover:bg-[#00E0B8] disabled:opacity-50 min-h-[44px]">
                  Salvar
                </button>
                <button (click)="editing.set(false)" class="flex-1 py-3 rounded-lg border border-white/[0.1] text-zinc-300 text-[13px] min-h-[44px]">
                  Cancelar
                </button>
              </div>
            } @else {
              @if (p.title) {
                <h2 class="text-[18px] font-semibold leading-tight break-words">{{ p.title }}</h2>
              }
              <p class="text-zinc-200 text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">{{ p.content }}</p>

              @if (p.imageUrl.startsWith('http')) {
                <img [src]="p.imageUrl" alt="" class="w-full max-h-80 object-cover rounded-xl" loading="lazy"/>
              } @else if (p.imageUrl) {
                <div class="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-zinc-500 text-[11.5px] flex items-center gap-2">
                  <span>🖼️</span> Mídia disponível apenas no dispositivo de origem
                </div>
              }
              @if (p.videoUrl.startsWith('http')) {
                <video [src]="p.videoUrl" controls class="w-full max-h-80 rounded-xl"></video>
              }

              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-500 text-[11px] font-mono pt-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                </svg>
                <span>{{ p.latitude.toFixed(5) }}, {{ p.longitude.toFixed(5) }}</span>
                @if (geo.location()) {
                  <span class="text-zinc-600">·</span>
                  <span>{{ fmtDist(distanceTo(p)) }}</span>
                }
              </div>

              @if (isOwner(p)) {
                <div class="flex gap-2 pt-3 border-t border-white/[0.05]">
                  <button
                    (click)="startEdit(p)"
                    class="flex-1 py-3 rounded-lg border border-white/[0.1] hover:border-[#00FFD1] hover:text-[#00FFD1] text-zinc-300 text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-linecap="round"/></svg>
                    Editar
                  </button>
                  <button
                    (click)="confirmDelete()"
                    class="flex-1 py-3 rounded-lg border border-[#FF4D6D]/30 hover:bg-[#FF4D6D]/10 text-[#FF4D6D] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" stroke-linecap="round"/></svg>
                    Excluir
                  </button>
                </div>
              }
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class MapPage implements AfterViewInit {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  protected readonly auth = inject(AuthService);
  protected readonly geo = inject(GeoLocationService);
  private readonly postsService = inject(PostsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<Post[]>([]);
  protected readonly radiusKm = signal(15);
  protected readonly selectedMapType = signal<MapType>('dark');
  protected readonly showSheet = signal(false);
  protected readonly selectedPost = signal<Post | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected searchQuery = '';
  protected editTitle = '';
  protected editContent = '';

  protected readonly radiusOptions = [1, 5, 10, 15, 25, 50, 100];
  protected readonly mapTypes: ReadonlyArray<{ k: MapType; l: string }> = [
    { k: 'dark', l: 'Escuro' },
    { k: 'padrao', l: 'Padrão' },
    { k: 'satelite', l: 'Satélite' },
    { k: 'relevo', l: 'Relevo' },
  ];

  protected readonly nearbyPosts = computed(() => {
    const loc = this.geo.location();
    if (!loc) return [] as { post: Post; distance: number }[];
    const r = this.radiusKm() * 1000;
    return this.posts()
      .map((post) => ({ post, distance: haversine(loc, post) }))
      .filter((x) => x.distance <= r)
      .sort((a, b) => a.distance - b.distance);
  });

  protected readonly filteredNearby = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.nearbyPosts();
    return this.nearbyPosts().filter(({ post }) =>
      post.title.toLowerCase().includes(q) ||
      post.content.toLowerCase().includes(q) ||
      post.userName.toLowerCase().includes(q)
    );
  });

  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private userMarker?: L.CircleMarker;
  private radiusCircle?: L.Circle;
  private readonly markers = new Map<string, L.Marker>();

  constructor() {
    effect(() => {
      const t = this.selectedMapType();
      if (this.map) this.applyTileLayer(t);
    });
    effect(() => {
      const loc = this.geo.location();
      const r = this.radiusKm();
      if (this.map && loc) this.updateRadiusCircle(loc, r);
    });
    effect(() => {
      const list = this.posts();
      if (this.map) this.renderMarkers(list);
    });

    const unsub = this.postsService.listenActivePosts((list) => this.posts.set(list));
    this.destroyRef.onDestroy(() => {
      unsub();
      this.map?.remove();
      this.geo.stop();
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.geo
      .request()
      .then((loc) => {
        this.map?.setView([loc.lat, loc.lng], 14);
        this.placeUserMarker(loc);
        this.updateRadiusCircle(loc, this.radiusKm());
        this.geo.watch();
      })
      .catch(() => { /* erro já tratado pelo serviço */ });

    // Garante redraw correto em mudanças de viewport (rotação, teclado virtual)
    if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.map?.invalidateSize());
      ro.observe(this.mapEl.nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    }
  }

  private initMap(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      center: [-23.55, -46.63],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });
    this.applyTileLayer(this.selectedMapType());
  }

  private applyTileLayer(type: MapType): void {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const cfg = TILE_LAYERS[type];
    this.tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.max,
    }).addTo(this.map);
  }

  private placeUserMarker(loc: LatLng): void {
    if (!this.map) return;
    this.userMarker?.remove();
    this.userMarker = L.circleMarker([loc.lat, loc.lng], {
      radius: 7,
      color: '#06070A',
      weight: 3,
      fillColor: '#00FFD1',
      fillOpacity: 1,
    }).addTo(this.map);
  }

  private updateRadiusCircle(loc: LatLng, km: number): void {
    if (!this.map) return;
    this.radiusCircle?.remove();
    this.radiusCircle = L.circle([loc.lat, loc.lng], {
      radius: km * 1000,
      color: '#00FFD1',
      weight: 1,
      fillColor: '#00FFD1',
      fillOpacity: 0.04,
      dashArray: '4 6',
    }).addTo(this.map);
    this.placeUserMarker(loc);
  }

  private renderMarkers(list: Post[]): void {
    if (!this.map) return;
    const ids = new Set(list.map((p) => p.id));
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
    for (const post of list) {
      let m = this.markers.get(post.id);
      if (!m) {
        const icon = L.divIcon({
          className: 'pulsar-marker',
          html: `<div class="pm-pin"><div class="pm-core"></div></div>`,
          iconSize: [24, 32],
          iconAnchor: [12, 32],
        });
        m = L.marker([post.latitude, post.longitude], { icon }).addTo(this.map);
        m.on('click', () => this.openPost(post));
        this.markers.set(post.id, m);
      } else {
        m.setLatLng([post.latitude, post.longitude]);
      }
    }
  }

  protected toggleSheet(): void {
    this.showSheet.update((v) => !v);
    if (!this.showSheet()) this.searchQuery = '';
  }

  protected centerOnUser(): void {
    const loc = this.geo.location();
    if (loc && this.map) {
      this.map.setView([loc.lat, loc.lng], 15);
    } else {
      this.geo.request().then((l) => this.map?.setView([l.lat, l.lng], 15)).catch(() => {});
    }
  }

  protected goCreate(): void { this.router.navigate(['/create']); }

  protected openPost(post: Post): void {
    this.selectedPost.set(post);
    this.editing.set(false);
    this.showSheet.set(false);
    this.map?.setView([post.latitude, post.longitude], Math.max(this.map.getZoom(), 15));
  }

  protected closePost(): void {
    this.selectedPost.set(null);
    this.editing.set(false);
  }

  protected isOwner(post: Post): boolean {
    return this.auth.user()?.uid === post.userId;
  }

  protected startEdit(post: Post): void {
    this.editTitle = post.title;
    this.editContent = post.content;
    this.editing.set(true);
  }

  protected async saveEdit(): Promise<void> {
    const post = this.selectedPost();
    if (!post || this.saving()) return;
    this.saving.set(true);
    try {
      await this.postsService.updatePost(post.id, {
        title: this.editTitle,
        content: this.editContent,
      });
      this.editing.set(false);
    } catch (e: any) {
      alert('Erro ao salvar: ' + (e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const post = this.selectedPost();
    if (!post) return;
    if (!confirm('Excluir este pulso? Esta ação é irreversível.')) return;
    try {
      await this.postsService.deletePost(post.id);
      this.closePost();
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e?.message ?? e));
    }
  }

  protected fmtDist = formatDistance;
  protected timeRem = timeRemaining;
  protected distanceTo(p: Post): number {
    const loc = this.geo.location();
    return loc ? haversine(loc, p) : 0;
  }
}

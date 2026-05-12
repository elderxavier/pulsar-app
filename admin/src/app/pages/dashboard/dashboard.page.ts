import { Component, ChangeDetectionStrategy, ElementRef, OnDestroy, ViewChild, AfterViewInit, inject, signal } from '@angular/core';
import { MetricsService, type KpiSnapshot } from '../../core/metrics.service';
import L from 'leaflet';
import 'leaflet.heat';

@Component({
  selector: 'admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-6 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Visão geral</h1>
          <p class="text-[12.5px] text-text-3">Snapshot atualizado a cada 30s.</p>
        </div>
        <button class="btn btn-ghost btn-sm" (click)="refresh()" [disabled]="loading()">
          {{ loading() ? 'Atualizando...' : 'Atualizar' }}
        </button>
      </header>

      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Posts ativos</div>
          <div class="text-2xl font-semibold tabular-nums">{{ kpi()?.activePosts ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Últimas 24h</div>
          <div class="text-2xl font-semibold tabular-nums">{{ kpi()?.postsLast24h ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Última hora</div>
          <div class="text-2xl font-semibold tabular-nums">{{ kpi()?.postsLast1h ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Autores únicos / 24h</div>
          <div class="text-2xl font-semibold tabular-nums">{{ kpi()?.uniqueAuthors24h ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Posts flaggados</div>
          <div class="text-2xl font-semibold tabular-nums text-amber">{{ kpi()?.flaggedPosts ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Denúncias abertas</div>
          <div class="text-2xl font-semibold tabular-nums text-danger">{{ kpi()?.openReports ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Expirados (amostra)</div>
          <div class="text-2xl font-semibold tabular-nums text-text-3">{{ kpi()?.expiredPosts ?? '—' }}</div>
        </div>
        <div class="surface rounded-xl p-4">
          <div class="text-[10.5px] uppercase tracking-wider text-text-3 mb-1.5">Status</div>
          <div class="text-sm font-medium pt-1">
            <span class="badge badge-success">operacional</span>
          </div>
        </div>
      </div>

      <!-- Heatmap -->
      <div class="surface rounded-xl overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/6">
          <div>
            <h2 class="text-sm font-semibold">Distribuição geográfica</h2>
            <p class="text-[11px] text-text-3">Posts ativos no mapa (heatmap)</p>
          </div>
          <span class="text-[11px] text-text-3 mono">{{ geoCount() }} pontos</span>
        </div>
        <div #mapEl class="h-[420px] w-full"></div>
      </div>
    </section>
  `,
})
export class DashboardPage implements AfterViewInit, OnDestroy {
  private metrics = inject(MetricsService);
  @ViewChild('mapEl', { static: false }) mapEl?: ElementRef<HTMLDivElement>;

  kpi = signal<KpiSnapshot | null>(null);
  geoCount = signal(0);
  loading = signal(false);

  private map?: L.Map;
  private heat?: any;
  private refreshTimer?: ReturnType<typeof setInterval>;

  async ngAfterViewInit() {
    if (this.mapEl) {
      this.map = L.map(this.mapEl.nativeElement, {
        center: [-15.78, -47.93],
        zoom: 4,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 19,
      }).addTo(this.map);
    }
    await this.refresh();
    this.refreshTimer = setInterval(() => this.refresh(), 30_000);
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.map?.remove();
  }

  async refresh() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const [snap, geo] = await Promise.all([
        this.metrics.snapshot(),
        this.metrics.activeGeoPoints(800),
      ]);
      this.kpi.set(snap);
      this.geoCount.set(geo.length);

      if (this.map) {
        if (this.heat) this.map.removeLayer(this.heat);
        if (geo.length > 0) {
          const data = geo.map((p) => [p.lat, p.lng, p.weight] as [number, number, number]);
          this.heat = (L as any).heatLayer(data, {
            radius: 22,
            blur: 18,
            maxZoom: 14,
            gradient: { 0.2: '#00FFD1', 0.5: '#FFB547', 0.8: '#FF3DA5' },
          }).addTo(this.map);
          const bounds = L.latLngBounds(geo.map((p) => [p.lat, p.lng] as [number, number]));
          if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
        }
      }
    } catch (err) {
      console.error('[Dashboard] refresh', err);
    } finally {
      this.loading.set(false);
    }
  }
}

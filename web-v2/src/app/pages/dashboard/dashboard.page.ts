import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PostsService, type Post } from '../../core/posts.service';
import { AuthService } from '../../core/auth.service';
import { GeoLocationService } from '../../core/geolocation.service';
import { formatDistance, haversine, progressPercent, timeAgo, timeRemaining } from '../../core/geo.util';

type SortMode = 'recent' | 'expiring' | 'distance';
type Filter = 'all' | 'mine' | 'expiring';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="min-h-[calc(100dvh-3.5rem)] md:min-h-dvh w-full px-4 sm:px-5 lg:px-10 py-6 lg:py-10 relative safe-pb">
      <div class="pulsar-ambient"></div>

      <header class="relative z-10 flex items-start sm:items-end justify-between gap-4 mb-7">
        <div class="min-w-0">
          <p class="text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">painel</p>
          <h1 class="text-[22px] sm:text-[26px] lg:text-[30px] font-semibold mt-0.5 truncate">Visão geral</h1>
          <p class="text-zinc-500 text-[13px] mt-1">{{ posts().length }} pulso{{ posts().length === 1 ? '' : 's' }} ativo{{ posts().length === 1 ? '' : 's' }} em tempo real.</p>
        </div>
        <button
          (click)="goCreate()"
          class="hidden sm:flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00FFD1] text-[#06070A] font-semibold text-[13px] hover:bg-[#00E0B8] active:scale-[0.98] transition-all glow-cyan min-h-[40px]"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14m7-7H5" stroke-linecap="round"/>
          </svg>
          Novo Pulso
        </button>
      </header>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7 relative z-10">
        @for (s of stats(); track s.label) {
          <article class="glass rounded-xl p-4">
            <p class="text-[10.5px] font-mono uppercase tracking-wider text-zinc-500">{{ s.label }}</p>
            <p class="text-[24px] font-semibold mt-1.5" [style.color]="s.color">{{ s.value }}</p>
            <p class="text-[11px] text-zinc-500 mt-0.5">{{ s.hint }}</p>
          </article>
        }
      </div>

      <!-- Controls -->
      <div class="flex flex-col lg:flex-row lg:items-center gap-3 mb-5 relative z-10">
        <div class="relative flex-1 min-w-0">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar pulsos…"
            class="w-full h-11 lg:h-10 bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg pl-9 pr-3 text-[13px] placeholder:text-zinc-600 outline-none transition-colors"
          />
        </div>
        <div class="flex gap-2 sm:gap-3 items-stretch">
          <div class="flex gap-1 glass rounded-lg p-1 overflow-x-auto no-scrollbar">
            @for (f of filters; track f.k) {
              <button
                (click)="filter.set(f.k)"
                class="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap"
                [class.bg-\[\#00FFD1\]]="filter() === f.k"
                [class.text-\[\#06070A\]]="filter() === f.k"
                [class.text-zinc-400]="filter() !== f.k"
              >{{ f.l }}</button>
            }
          </div>
          <select
            [ngModel]="sort()"
            (ngModelChange)="sort.set($event)"
            class="flex-1 sm:flex-none h-11 lg:h-10 bg-[#0B0D12] border border-white/[0.08] rounded-lg px-3 text-[12.5px] outline-none focus:border-[#00FFD1]"
          >
            <option value="recent">Mais recentes</option>
            <option value="expiring">Expirando</option>
            <option value="distance">Distância</option>
          </select>
        </div>
      </div>

      <!-- List -->
      <div class="relative z-10">
        @if (visible().length === 0) {
          <div class="glass rounded-2xl py-16 px-6 text-center">
            <svg class="w-12 h-12 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"/>
            </svg>
            <p class="text-zinc-400 text-[13.5px]">Nenhum pulso encontrado.</p>
            <p class="text-zinc-500 text-[12px] mt-1">Ajuste filtros ou crie um novo.</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            @for (p of visible(); track p.id) {
              <article class="glass rounded-xl p-4 flex flex-col gap-3 hover:border-[#00FFD1]/20 transition-colors group">
                <header class="flex items-start gap-3">
                  <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFD1]/40 to-[#006B58]/40 border border-[#00FFD1]/20 flex items-center justify-center text-[#00FFD1] text-[12px] font-bold shrink-0">
                    {{ p.userName[0]?.toUpperCase() ?? '?' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-[13px] font-semibold text-white truncate">{{ p.userName }}</span>
                      @if (isOwner(p)) {
                        <span class="text-[9.5px] uppercase tracking-wider text-[#00FFD1] bg-[#00FFD1]/10 border border-[#00FFD1]/20 px-1.5 py-0.5 rounded">você</span>
                      }
                    </div>
                    <p class="text-[10.5px] text-zinc-500">{{ ago(p.createdAt) }} atrás</p>
                  </div>
                  @if (isOwner(p)) {
                    <button
                      (click)="remove(p)"
                      class="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[#FF4D6D]/10 text-[#FF4D6D] transition-opacity"
                      title="Excluir"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" stroke-linecap="round"/>
                      </svg>
                    </button>
                  }
                </header>

                @if (p.title) {
                  <h3 class="text-[14px] font-semibold leading-snug">{{ p.title }}</h3>
                }
                <p class="text-zinc-300 text-[13px] leading-relaxed clamp-3">{{ p.content }}</p>

                @if (p.imageUrl.startsWith('http')) {
                  <img [src]="p.imageUrl" alt="" class="w-full h-32 object-cover rounded-lg" loading="lazy"/>
                }

                <footer class="mt-auto space-y-2">
                  <div class="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-[#00FFD1] to-[#FF3DA5] rounded-full transition-[width]"
                      [style.width.%]="prog(p)"
                    ></div>
                  </div>
                  <div class="flex items-center justify-between text-[10.5px] font-mono">
                    <span class="text-zinc-500">expira em {{ rem(p) }}</span>
                    @if (geo.location()) {
                      <span class="text-zinc-500">{{ dist(p) }}</span>
                    }
                  </div>
                </footer>
              </article>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly geo = inject(GeoLocationService);
  private readonly postsSvc = inject(PostsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly posts = signal<Post[]>([]);
  protected searchQuery = '';
  protected readonly filter = signal<Filter>('all');
  protected readonly sort = signal<SortMode>('recent');

  protected readonly filters: ReadonlyArray<{ k: Filter; l: string }> = [
    { k: 'all', l: 'Todos' },
    { k: 'mine', l: 'Meus' },
    { k: 'expiring', l: 'Expirando' },
  ];

  protected readonly stats = computed(() => {
    const list = this.posts();
    const me = this.auth.user()?.uid;
    const mine = list.filter((p) => p.userId === me).length;
    const soon = list.filter((p) => p.expiresAt.toMillis() - Date.now() < 3_600_000).length;
    const loc = this.geo.location();
    const within = loc ? list.filter((p) => haversine(loc, p) <= 5_000).length : 0;
    return [
      { label: 'Ativos', value: list.length.toString(), hint: 'pulsos visíveis', color: '#00FFD1' },
      { label: 'Meus', value: mine.toString(), hint: 'publicados por você', color: '#F5F7FA' },
      { label: 'Expirando', value: soon.toString(), hint: 'em menos de 1h', color: '#FFB547' },
      { label: 'Próximos', value: within.toString(), hint: 'até 5km de você', color: '#FF3DA5' },
    ];
  });

  protected readonly visible = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const f = this.filter();
    const s = this.sort();
    const me = this.auth.user()?.uid;
    const loc = this.geo.location();

    let list = this.posts().slice();
    if (f === 'mine') list = list.filter((p) => p.userId === me);
    if (f === 'expiring') list = list.filter((p) => p.expiresAt.toMillis() - Date.now() < 3_600_000);
    if (q) {
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (s) {
        case 'recent':
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        case 'expiring':
          return a.expiresAt.toMillis() - b.expiresAt.toMillis();
        case 'distance':
          if (!loc) return 0;
          return haversine(loc, a) - haversine(loc, b);
      }
    });
    return list;
  });

  constructor() {
    const unsub = this.postsSvc.listenActivePosts((list) => this.posts.set(list));
    this.destroyRef.onDestroy(unsub);
    if (!this.geo.location()) this.geo.request().catch(() => {});
  }

  protected goCreate(): void { this.router.navigate(['/create']); }
  protected isOwner(p: Post): boolean { return this.auth.user()?.uid === p.userId; }
  protected ago = (t: Post['createdAt']) => timeAgo(t);
  protected rem = (p: Post) => timeRemaining(p);
  protected prog = (p: Post) => progressPercent(p);
  protected dist(p: Post): string {
    const loc = this.geo.location();
    return loc ? formatDistance(haversine(loc, p)) : '';
  }

  protected async remove(p: Post): Promise<void> {
    if (!confirm('Excluir este pulso?')) return;
    try {
      await this.postsSvc.deletePost(p.id);
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e?.message ?? e));
    }
  }
}

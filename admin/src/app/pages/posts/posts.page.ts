import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPostsService, type AdminPost, type PostFilter } from '../../core/posts-admin.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'admin-posts',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-4 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Posts / Pulsos</h1>
          <p class="text-[12.5px] text-text-3">{{ filtered().length }} de {{ posts().length }} carregados</p>
        </div>
        <div class="flex gap-2 items-center">
          <input class="input" [(ngModel)]="search" placeholder="Buscar texto ou autor..." style="min-width: 260px" />
          <select class="select" [(ngModel)]="filter" style="min-width: 140px">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="expired">Expirados</option>
            <option value="flagged">Flaggados</option>
          </select>
        </div>
      </header>

      <div class="surface rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th style="width: 38%">Conteúdo</th>
                <th>Autor</th>
                <th>Coords</th>
                <th>Criado</th>
                <th>Expira</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr>
                  <td>
                    @if (p.title) { <div class="text-text-1 font-medium clamp-1">{{ p.title }}</div> }
                    <div class="text-text-2 clamp-2 text-[12px]">{{ p.content || '(sem conteúdo)' }}</div>
                    @if (p.imageUrl) { <span class="badge badge-zinc mt-1">imagem</span> }
                    @if (p.videoUrl) { <span class="badge badge-zinc mt-1 ml-1">vídeo</span> }
                  </td>
                  <td>
                    <div class="clamp-1">{{ p.userName }}</div>
                    <div class="text-[10.5px] text-text-3 mono clamp-1">{{ shortUid(p.userId) }}</div>
                  </td>
                  <td class="mono text-[11px] text-text-3 whitespace-nowrap">
                    {{ p.latitude.toFixed(3) }},<br>{{ p.longitude.toFixed(3) }}
                  </td>
                  <td class="text-text-3 whitespace-nowrap">{{ formatDate(p.createdAt) }}</td>
                  <td class="text-text-3 whitespace-nowrap">{{ formatDate(p.expiresAt) }}</td>
                  <td>
                    @if (isExpired(p)) {
                      <span class="badge badge-zinc">expirado</span>
                    } @else {
                      <span class="badge badge-success">ativo</span>
                    }
                    @if (p.flagged) { <span class="badge badge-amber ml-1">flag</span> }
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <a class="btn btn-ghost btn-sm" [href]="mapsLink(p)" target="_blank" rel="noopener">Mapa</a>
                    @if (!p.flagged) {
                      <button class="btn btn-warn btn-sm ml-1" (click)="flag(p)">Flag</button>
                    } @else {
                      <button class="btn btn-ghost btn-sm ml-1" (click)="unflag(p)">Unflag</button>
                    }
                    @if (!isExpired(p)) {
                      <button class="btn btn-ghost btn-sm ml-1" (click)="expire(p)">Expirar</button>
                    }
                    <button class="btn btn-danger btn-sm ml-1" (click)="remove(p)">Excluir</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="text-center text-text-3 py-10">Nenhum post.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
})
export class PostsPage implements OnInit, OnDestroy {
  private svc = inject(AdminPostsService);
  posts = signal<AdminPost[]>([]);
  search = signal('');
  filter = signal<PostFilter>('all');
  private unsub?: () => void;
  private now = Date.now();

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.filter();
    const now = this.now;
    return this.posts().filter((p) => {
      if (q && !p.content.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q) && !p.userName.toLowerCase().includes(q)) return false;
      const expired = p.expiresAt.toMillis() <= now;
      if (f === 'active' && expired) return false;
      if (f === 'expired' && !expired) return false;
      if (f === 'flagged' && !p.flagged) return false;
      return true;
    });
  });

  ngOnInit() {
    this.unsub = this.svc.listenAll((list) => {
      this.now = Date.now();
      this.posts.set(list);
    });
  }
  ngOnDestroy() { this.unsub?.(); }

  isExpired(p: AdminPost) { return p.expiresAt.toMillis() <= Date.now(); }
  shortUid(uid: string) { return uid.length > 10 ? `${uid.slice(0, 5)}…${uid.slice(-3)}` : uid; }
  formatDate(t: Timestamp) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(t.toDate());
  }
  mapsLink(p: AdminPost) {
    return `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=16/${p.latitude}/${p.longitude}`;
  }

  async remove(p: AdminPost) {
    const reason = window.prompt(`Motivo da exclusão do post "${p.content.slice(0, 60)}"?`, '');
    if (reason === null) return;
    await this.svc.deletePost(p.id, reason);
  }
  async expire(p: AdminPost) {
    if (!confirm('Forçar expiração deste post?')) return;
    await this.svc.forceExpire(p.id);
  }
  async flag(p: AdminPost) {
    const reason = window.prompt('Motivo do flag?', '');
    if (reason === null) return;
    await this.svc.flagPost(p.id, reason);
  }
  async unflag(p: AdminPost) {
    if (!confirm('Remover flag?')) return;
    await this.svc.unflagPost(p.id);
  }
}

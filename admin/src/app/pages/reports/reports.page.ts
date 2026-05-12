import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportsService, type Report, type ReportStatus } from '../../core/reports.service';
import { AdminPostsService } from '../../core/posts-admin.service';
import { Timestamp } from 'firebase/firestore';

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  hate_speech: 'Discurso de ódio',
  violence: 'Violência',
  sexual_content: 'Conteúdo sexual',
  misinformation: 'Desinformação',
  other: 'Outro',
};

@Component({
  selector: 'admin-reports',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-4 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Denúncias</h1>
          <p class="text-[12.5px] text-text-3">{{ filtered().length }} de {{ reports().length }}</p>
        </div>
        <select class="select" [(ngModel)]="filter" style="min-width: 160px">
          <option value="all">Todas</option>
          <option value="open">Abertas</option>
          <option value="reviewing">Em análise</option>
          <option value="dismissed">Descartadas</option>
          <option value="actioned">Ação tomada</option>
        </select>
      </header>

      <div class="surface rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>Post</th>
                <th>Motivo</th>
                <th>Denunciante</th>
                <th>Quando</th>
                <th>Status</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filtered(); track r.id) {
                <tr>
                  <td>
                    <div class="text-text-1 clamp-2 text-[12px]">{{ r.postPreview || '(sem preview)' }}</div>
                    <div class="text-[10.5px] text-text-3 mono mt-0.5">{{ r.postId }}</div>
                  </td>
                  <td>
                    <span class="badge badge-amber">{{ reasonLabel(r.reason) }}</span>
                    @if (r.details) {
                      <div class="text-[11px] text-text-3 clamp-2 mt-1">{{ r.details }}</div>
                    }
                  </td>
                  <td>
                    <div class="clamp-1">{{ r.reporterName }}</div>
                  </td>
                  <td class="text-text-3 whitespace-nowrap">{{ formatDate(r.createdAt) }}</td>
                  <td>
                    <span class="badge" [class]="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    @if (r.status === 'open') {
                      <button class="btn btn-ghost btn-sm" (click)="setStatus(r, 'reviewing')">Analisar</button>
                    }
                    @if (r.status !== 'dismissed' && r.status !== 'actioned') {
                      <button class="btn btn-ghost btn-sm ml-1" (click)="dismiss(r)">Descartar</button>
                      <button class="btn btn-danger btn-sm ml-1" (click)="actionAndDelete(r)">Ação + excluir post</button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="text-center text-text-3 py-10">Nenhuma denúncia.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
})
export class ReportsPage implements OnInit, OnDestroy {
  private svc = inject(ReportsService);
  private posts = inject(AdminPostsService);

  reports = signal<Report[]>([]);
  filter = signal<'all' | ReportStatus>('all');

  filtered = computed(() => {
    const f = this.filter();
    return this.reports().filter((r) => f === 'all' || r.status === f);
  });

  private unsub?: () => void;
  ngOnInit() { this.unsub = this.svc.listenAll((list) => this.reports.set(list)); }
  ngOnDestroy() { this.unsub?.(); }

  reasonLabel(r: string) { return REASON_LABEL[r] ?? r; }
  statusLabel(s: ReportStatus): string {
    return { open: 'Aberta', reviewing: 'Em análise', dismissed: 'Descartada', actioned: 'Acionada' }[s];
  }
  statusClass(s: ReportStatus): string {
    return ({
      open: 'badge-danger',
      reviewing: 'badge-amber',
      dismissed: 'badge-zinc',
      actioned: 'badge-success',
    } as const)[s];
  }
  formatDate(t: Timestamp) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(t.toDate());
  }

  async setStatus(r: Report, s: ReportStatus) { await this.svc.setStatus(r.id, s); }

  async dismiss(r: Report) {
    const note = window.prompt('Nota (opcional):', '') ?? undefined;
    await this.svc.setStatus(r.id, 'dismissed', note);
  }

  async actionAndDelete(r: Report) {
    const note = window.prompt('Motivo da ação:', '');
    if (note === null) return;
    if (!confirm(`Excluir o post denunciado (${r.postId}) e marcar denúncia como acionada?`)) return;
    try { await this.posts.deletePost(r.postId, `[via report ${r.id}] ${note}`); } catch (err) { console.error(err); }
    await this.svc.setStatus(r.id, 'actioned', note);
  }
}

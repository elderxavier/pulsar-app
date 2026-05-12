import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditService, type AuditEntry } from '../../core/audit.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'admin-logs',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-4 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Logs de auditoria</h1>
          <p class="text-[12.5px] text-text-3">{{ filtered().length }} de {{ entries().length }} entradas recentes</p>
        </div>
        <div class="flex gap-2 items-center">
          <input class="input" [(ngModel)]="filter" placeholder="Filtrar ação / autor / alvo..." style="min-width: 280px">
        </div>
      </header>

      <div class="surface rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Autor</th>
                <th>Alvo</th>
                <th>Motivo / detalhes</th>
              </tr>
            </thead>
            <tbody>
              @for (e of filtered(); track e.id) {
                <tr>
                  <td class="mono text-[11px] text-text-3 whitespace-nowrap">{{ formatDate(e.createdAt) }}</td>
                  <td><span class="badge" [class]="badgeFor(e.action)">{{ e.action }}</span></td>
                  <td>
                    <div class="clamp-1">{{ e.actorName }}</div>
                    <div class="text-[10.5px] text-text-3 mono">{{ shortUid(e.actorId) }}</div>
                  </td>
                  <td class="mono text-[11px] text-text-3">{{ e.target }}</td>
                  <td class="text-text-2 clamp-2 text-[12px]">{{ e.reason || '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="text-center text-text-3 py-10">Sem logs.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
})
export class LogsPage implements OnInit, OnDestroy {
  private svc = inject(AuditService);
  entries = signal<AuditEntry[]>([]);
  filter = signal('');

  filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.entries();
    return this.entries().filter((e) =>
      e.action.toLowerCase().includes(q) ||
      e.actorName.toLowerCase().includes(q) ||
      e.actorId.toLowerCase().includes(q) ||
      e.target.toLowerCase().includes(q) ||
      (e.reason ?? '').toLowerCase().includes(q),
    );
  });

  private unsub?: () => void;
  ngOnInit() { this.unsub = this.svc.listenRecent((list) => this.entries.set(list), 300); }
  ngOnDestroy() { this.unsub?.(); }

  shortUid(uid: string) { return uid.length > 10 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid; }
  formatDate(t: Timestamp) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(t.toDate());
  }
  badgeFor(action: string): string {
    if (action.includes('delete') || action.includes('ban') || action.startsWith('report.actioned')) return 'badge-danger';
    if (action.startsWith('config.') || action.includes('promote')) return 'badge-cyan';
    if (action.includes('flag') || action.includes('expire') || action.startsWith('report.reviewing')) return 'badge-amber';
    if (action.includes('unban') || action.includes('unflag') || action.startsWith('report.dismissed')) return 'badge-success';
    return 'badge-zinc';
  }
}

import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UsersAdminService, type AdminUser } from '../../core/users-admin.service';
import { AuthService } from '../../core/auth.service';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'admin-users',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-4 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Usuários</h1>
          <p class="text-[12.5px] text-text-3">{{ filtered().length }} de {{ users().length }}</p>
        </div>
        <div class="flex gap-2 items-center">
          <input class="input" [(ngModel)]="filter" placeholder="Buscar por nome ou UID..." style="min-width: 260px" />
          <select class="select" [(ngModel)]="status" style="min-width: 140px">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="banned">Banidos</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </header>

      <div class="surface rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>UID</th>
                <th>Posts</th>
                <th>Status</th>
                <th>Último acesso</th>
                <th class="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (u of filtered(); track u.uid) {
                <tr>
                  <td>
                    <div class="flex items-center gap-2.5">
                      <div class="w-7 h-7 rounded-full bg-bg-2 border border-white/8 flex items-center justify-center text-[11px] font-semibold text-cyan">
                        {{ initials(u.displayName) }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-text-1 clamp-1">{{ u.displayName }}</div>
                        @if (u.email) {
                          <div class="text-[10.5px] text-text-3 clamp-1">{{ u.email }}</div>
                        }
                      </div>
                    </div>
                  </td>
                  <td><span class="mono text-text-3">{{ shortUid(u.uid) }}</span></td>
                  <td class="tabular-nums">{{ u.postsCount ?? 0 }}</td>
                  <td>
                    <div class="flex gap-1 flex-wrap">
                      @if (u.banned) { <span class="badge badge-danger">banido</span> }
                      @if (u.adminRequested) { <span class="badge badge-cyan">admin</span> }
                      @if (!u.banned && !u.adminRequested) { <span class="badge badge-zinc">ativo</span> }
                    </div>
                  </td>
                  <td class="text-text-3">{{ formatDate(u.lastSeenAt) }}</td>
                  <td class="text-right whitespace-nowrap">
                    @if (u.banned) {
                      <button class="btn btn-ghost btn-sm" (click)="unban(u)">Desbanir</button>
                    } @else {
                      <button class="btn btn-danger btn-sm" (click)="ban(u)">Banir</button>
                    }
                    @if (auth.isSuperAdmin()) {
                      @if (u.adminRequested) {
                        <button class="btn btn-warn btn-sm ml-1" (click)="revoke(u)">Revogar</button>
                      } @else {
                        <button class="btn btn-ghost btn-sm ml-1" (click)="promote(u)">Promover</button>
                      }
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center text-text-3 py-10">Nenhum usuário encontrado.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (auth.isSuperAdmin()) {
        <p class="text-[11px] text-text-3">
          Promover marca o usuário com <code class="kbd">adminRequested=true</code>.
          A claim real é aplicada com <code class="kbd">npm run set-admin -- &lt;email&gt;</code>.
        </p>
      }
    </section>
  `,
})
export class UsersPage implements OnInit, OnDestroy {
  private svc = inject(UsersAdminService);
  readonly auth = inject(AuthService);

  users = signal<AdminUser[]>([]);
  filter = signal('');
  status = signal<'all' | 'active' | 'banned' | 'admin'>('all');

  filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const s = this.status();
    return this.users().filter((u) => {
      if (q && !u.displayName.toLowerCase().includes(q) && !u.uid.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (s === 'active' && (u.banned || u.adminRequested)) return false;
      if (s === 'banned' && !u.banned) return false;
      if (s === 'admin' && !u.adminRequested) return false;
      return true;
    });
  });

  private unsub?: () => void;

  ngOnInit() {
    this.unsub = this.svc.listenAll((list) => this.users.set(list));
  }

  ngOnDestroy() { this.unsub?.(); }

  initials(name: string) {
    return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  }

  shortUid(uid: string) { return uid.length > 12 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid; }

  formatDate(t?: Timestamp) {
    if (!t) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(t.toDate());
  }

  async ban(u: AdminUser) {
    const reason = window.prompt(`Motivo do banimento de ${u.displayName}?`, '');
    if (reason === null) return;
    await this.svc.banUser(u.uid, reason);
  }

  async unban(u: AdminUser) {
    if (!confirm(`Desbanir ${u.displayName}?`)) return;
    await this.svc.unbanUser(u.uid);
  }

  async promote(u: AdminUser) {
    if (!confirm(`Promover ${u.displayName} a admin? Você ainda precisará rodar o script set-admin para aplicar a claim.`)) return;
    await this.svc.requestPromote(u.uid);
  }

  async revoke(u: AdminUser) {
    if (!confirm(`Revogar privilégio admin de ${u.displayName}?`)) return;
    await this.svc.revokeAdmin(u.uid);
  }
}

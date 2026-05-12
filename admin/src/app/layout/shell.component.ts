import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  superOnly?: boolean;
}

@Component({
  selector: 'admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex bg-bg-0 relative z-10">
      <!-- ============ SIDEBAR DESKTOP ============ -->
      <aside class="hidden md:flex w-60 flex-col border-r border-white/6 bg-bg-1/70 backdrop-blur-xl">
        <div class="px-5 py-5 flex items-center gap-2.5 border-b border-white/6">
          <div class="brand-dot"></div>
          <div class="flex flex-col">
            <span class="text-sm font-semibold tracking-tight">Pulsar</span>
            <span class="text-[10.5px] uppercase tracking-[0.14em] text-text-3 font-medium">Admin Console</span>
          </div>
        </div>

        <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          @for (item of nav; track item.path) {
            @if (!item.superOnly || auth.isSuperAdmin()) {
              <a
                [routerLink]="['/', item.path]"
                routerLinkActive="bg-white/5 text-text-1 border-cyan/40"
                [routerLinkActiveOptions]="{ exact: false }"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-text-2 border border-transparent hover:bg-white/4 hover:text-text-1 transition-colors">
                <span class="text-base leading-none w-4 text-center" [innerHTML]="item.icon"></span>
                {{ item.label }}
              </a>
            }
          }
        </nav>

        <div class="p-3 border-t border-white/6 space-y-2">
          <div class="px-2 flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-bg-2 border border-white/8 flex items-center justify-center text-xs font-semibold text-cyan">
              {{ initials() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[12.5px] font-medium clamp-1">{{ auth.displayName() }}</div>
              <div class="text-[10.5px] text-text-3 clamp-1">
                @if (auth.isSuperAdmin()) {
                  <span class="badge badge-cyan">super-admin</span>
                } @else {
                  <span class="badge badge-zinc">admin</span>
                }
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm w-full justify-center" (click)="logout()">Sair</button>
        </div>
      </aside>

      <!-- ============ MAIN ============ -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Topbar mobile -->
        <header class="md:hidden flex items-center justify-between gap-3 px-4 h-14 border-b border-white/6 bg-bg-1/80 backdrop-blur-xl safe-pt sticky top-0 z-30">
          <button class="p-2 -ml-2" (click)="mobileOpen.set(true)" aria-label="Abrir menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="flex items-center gap-2">
            <div class="brand-dot"></div>
            <span class="text-sm font-semibold">Pulsar Admin</span>
          </div>
          <button class="p-2 -mr-2 text-text-2" (click)="logout()" aria-label="Sair">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </header>

        <!-- Drawer mobile -->
        @if (mobileOpen()) {
          <div class="md:hidden fixed inset-0 z-40 anim-fade-in" (click)="mobileOpen.set(false)">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <aside class="absolute top-0 left-0 bottom-0 w-72 bg-bg-1 border-r border-white/6 flex flex-col safe-pt anim-slide-up" (click)="$event.stopPropagation()">
              <div class="px-5 py-5 flex items-center gap-2.5 border-b border-white/6">
                <div class="brand-dot"></div>
                <span class="text-sm font-semibold">Pulsar Admin</span>
              </div>
              <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                @for (item of nav; track item.path) {
                  @if (!item.superOnly || auth.isSuperAdmin()) {
                    <a
                      [routerLink]="['/', item.path]"
                      routerLinkActive="bg-white/5 text-text-1 border-cyan/40"
                      class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-text-2 border border-transparent hover:bg-white/4 hover:text-text-1"
                      (click)="mobileOpen.set(false)">
                      <span class="text-base w-4 text-center" [innerHTML]="item.icon"></span>
                      {{ item.label }}
                    </a>
                  }
                }
              </nav>
            </aside>
          </div>
        }

        <div class="flex-1 overflow-y-auto">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  readonly mobileOpen = signal(false);

  readonly nav: NavItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: '◆' },
    { path: 'users',     label: 'Usuários',  icon: '◉' },
    { path: 'posts',     label: 'Posts',     icon: '✦' },
    { path: 'reports',   label: 'Denúncias', icon: '!' },
    { path: 'metrics',   label: 'Métricas',  icon: '∿' },
    { path: 'logs',      label: 'Logs',      icon: '≡' },
    { path: 'settings',  label: 'Config.',   icon: '⚙', superOnly: true },
  ];

  initials() {
    const n = this.auth.displayName();
    return n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'A';
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}

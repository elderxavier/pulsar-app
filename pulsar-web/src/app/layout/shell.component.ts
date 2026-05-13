import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string; // SVG path d
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="relative min-h-dvh flex">
      <!-- Sidebar Desktop / Tablet (colapsada em md, full em lg) -->
      <aside
        class="hidden md:flex flex-col shrink-0 relative z-20 glass-strong border-r border-white/[0.06] safe-pl
               w-[68px] lg:w-[240px] transition-[width] duration-200"
      >
        <div class="px-3 lg:px-5 pt-6 pb-4 flex items-center gap-2.5 justify-center lg:justify-start">
          <span class="brand-dot shrink-0"></span>
          <span class="hidden lg:inline font-bold tracking-[0.22em] text-[15px] text-glow-cyan">PULSAR</span>
        </div>

        <nav class="flex-1 px-2 lg:px-3 pt-2 space-y-1">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              #rla="routerLinkActive"
              [title]="item.label"
              class="group relative flex items-center gap-3 px-2.5 lg:px-3 py-2.5 rounded-lg text-[13.5px] transition-colors min-h-[40px]"
              [class.bg-white\/\[0\.04\]]="rla.isActive"
              [class.text-white]="rla.isActive"
              [class.text-zinc-400]="!rla.isActive"
            >
              <span
                class="hidden lg:block w-1 h-5 rounded-full transition-all"
                [class.bg-\[\#00FFD1\]]="rla.isActive"
                [class.bg-transparent]="!rla.isActive"
                [class.shadow-\[0_0_8px_rgba\(0\,255\,209\,0\.6\)\]]="rla.isActive"
              ></span>
              <svg class="w-[18px] h-[18px] lg:w-4 lg:h-4 shrink-0 mx-auto lg:mx-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path [attr.d]="item.icon" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="hidden lg:inline font-medium">{{ item.label }}</span>
              <!-- tooltip md only -->
              <span class="lg:hidden absolute left-full ml-2 px-2 py-1 rounded bg-[#11141B] border border-white/[0.08] text-[11px] text-zinc-200 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {{ item.label }}
              </span>
            </a>
          }
        </nav>

        <!-- CTA Criar -->
        <div class="px-2 lg:px-3 pb-3">
          <button
            (click)="goCreate()"
            [title]="'Novo Pulso'"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00FFD1] text-[#06070A] font-semibold text-[13px] hover:bg-[#00E0B8] active:scale-[0.98] transition-all glow-cyan min-h-[40px]"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14m7-7H5" stroke-linecap="round"/>
            </svg>
            <span class="hidden lg:inline">Novo Pulso</span>
          </button>
        </div>

        <!-- User -->
        <div class="px-2 lg:px-3 pb-4 safe-pb border-t border-white/[0.04] pt-3">
          <div class="flex items-center gap-2.5 px-1 lg:px-2 py-1.5">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFD1] to-[#006B58] flex items-center justify-center text-[#06070A] text-xs font-bold shrink-0 mx-auto lg:mx-0" [title]="auth.displayName()">
              {{ initials() }}
            </div>
            <div class="hidden lg:block flex-1 min-w-0">
              <p class="text-[12.5px] text-white truncate font-medium">{{ auth.displayName() }}</p>
              <p class="text-[10.5px] text-zinc-500">
                @if (auth.user()?.isAnonymous) { anônimo } @else { online }
              </p>
            </div>
            <button (click)="logout()" class="hidden lg:flex w-10 h-10 items-center justify-center rounded hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-200" title="Sair">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
              </svg>
            </button>
          </div>
          <button (click)="logout()" class="lg:hidden w-full mt-2 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] py-2" title="Sair">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
          </button>
        </div>
      </aside>

      <!-- Mobile Topbar (apenas <md) -->
      <header
        class="md:hidden fixed top-0 inset-x-0 z-30 h-14 px-4 flex items-center justify-between glass-strong border-b border-white/[0.06] safe-pt"
      >
        <button
          (click)="mobileOpen.set(true)"
          class="w-10 h-10 -ml-2 rounded flex items-center justify-center hover:bg-white/[0.05] text-zinc-300"
          aria-label="Abrir menu"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="flex items-center gap-2">
          <span class="brand-dot"></span>
          <span class="font-bold tracking-[0.22em] text-[14px]">PULSAR</span>
        </div>
        <button
          (click)="goCreate()"
          class="w-10 h-10 rounded-full bg-[#00FFD1] text-[#06070A] flex items-center justify-center glow-cyan"
          aria-label="Criar pulso"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14m7-7H5" stroke-linecap="round"/>
          </svg>
        </button>
      </header>

      <!-- Mobile Drawer (apenas <md) -->
      @if (mobileOpen()) {
        <div
          class="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm anim-fade-in"
          (click)="mobileOpen.set(false)"
        ></div>
        <aside
          class="md:hidden fixed inset-y-0 left-0 z-50 w-[78vw] max-w-[300px] glass-strong border-r border-white/[0.08] flex flex-col anim-slide-up safe-pt safe-pb safe-pl"
        >
          <div class="px-5 pt-6 pb-4 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="brand-dot"></span>
              <span class="font-bold tracking-[0.22em] text-[15px]">PULSAR</span>
            </div>
            <button (click)="mobileOpen.set(false)" class="w-10 h-10 rounded flex items-center justify-center hover:bg-white/[0.05]" aria-label="Fechar menu">
              <svg class="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <nav class="flex-1 px-3 pt-2 space-y-0.5">
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                (click)="mobileOpen.set(false)"
                routerLinkActive="active"
                #rla="routerLinkActive"
                class="flex items-center gap-3 px-3 py-3 rounded-lg text-sm min-h-[44px]"
                [class.bg-white\/\[0\.04\]]="rla.isActive"
                [class.text-white]="rla.isActive"
                [class.text-zinc-400]="!rla.isActive"
              >
                <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path [attr.d]="item.icon" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="px-3 pb-4 border-t border-white/[0.04] pt-3 space-y-2">
            <div class="flex items-center gap-2.5 px-2 py-1.5">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FFD1] to-[#006B58] flex items-center justify-center text-[#06070A] text-xs font-bold">
                {{ initials() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[12.5px] text-white truncate font-medium">{{ auth.displayName() }}</p>
                <p class="text-[10.5px] text-zinc-500">
                  @if (auth.user()?.isAnonymous) { anônimo } @else { online }
                </p>
              </div>
            </div>
            <button
              (click)="logout()"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-300 hover:bg-white/[0.05] text-sm min-h-[44px]"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Sair
            </button>
          </div>
        </aside>
      }

      <!-- Main Content -->
      <main class="flex-1 min-w-0 relative z-10 md:pt-0 pt-14">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mobileOpen = signal(false);

  protected readonly nav: NavItem[] = [
    {
      label: 'Mapa',
      path: '/map',
      icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.553 2.776A1 1 0 0022 18.882V8.118a1 1 0 00-1.447-.894L15 10m0 7V10m0 0L9 7',
    },
    {
      label: 'Painel',
      path: '/dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
  ];

  protected initials(): string {
    const name = this.auth.displayName();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?';
  }

  protected goCreate(): void {
    this.mobileOpen.set(false);
    this.router.navigate(['/create']);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative z-10 min-h-dvh flex items-center justify-center p-4 sm:p-6 safe-pt safe-pb">
      <div class="w-full max-w-[420px] glass rounded-2xl p-6 sm:p-8 anim-slide-up">
        <div class="flex items-center gap-3 mb-2">
          <span class="brand-dot"></span>
          <span class="font-bold tracking-[0.25em] text-[15px] text-glow-cyan">PULSAR</span>
        </div>
        <h1 class="text-2xl font-bold mb-1">
          @if (mode() === 'login') { Entrar } @else { Criar conta }
        </h1>
        <p class="text-zinc-400 text-sm mb-6">
          Microblog hiperlocal — pulsos efêmeros geolocalizados.
        </p>

        <form (ngSubmit)="submit()" class="space-y-3">
          @if (mode() === 'register') {
            <label class="block">
              <span class="text-[11px] text-zinc-500 uppercase tracking-wider">Nome</span>
              <input
                type="text"
                name="name"
                [(ngModel)]="name"
                autocomplete="name"
                maxlength="40"
                placeholder="Como vai aparecer"
                class="mt-1 w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-3 text-[14px] placeholder:text-zinc-600 outline-none transition-colors"
              />
            </label>
          }

          <label class="block">
            <span class="text-[11px] text-zinc-500 uppercase tracking-wider">E-mail</span>
            <input
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="email"
              placeholder="voce@pulsar.app"
              class="mt-1 w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-3 text-[14px] placeholder:text-zinc-600 outline-none transition-colors"
            />
          </label>

          <label class="block">
            <span class="text-[11px] text-zinc-500 uppercase tracking-wider">Senha</span>
            <input
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              minlength="6"
              [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
              placeholder="••••••••"
              class="mt-1 w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-3 text-[14px] placeholder:text-zinc-600 outline-none transition-colors"
            />
          </label>

          @if (error()) {
            <div class="flex items-start gap-2 p-3 rounded-lg bg-[#FF4D6D]/10 border border-[#FF4D6D]/30">
              <svg class="w-4 h-4 text-[#FF4D6D] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"/>
              </svg>
              <span class="text-[12.5px] text-[#FF4D6D]">{{ error() }}</span>
            </div>
          }

          <button
            type="submit"
            [disabled]="loading()"
            class="w-full py-3 rounded-lg bg-[#00FFD1] text-[#06070A] font-semibold text-[14px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00E0B8] active:scale-[0.98] transition-all glow-cyan"
          >
            @if (loading()) {
              <span class="inline-flex items-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                </svg>
                Carregando…
              </span>
            } @else {
              {{ mode() === 'login' ? 'Entrar' : 'Criar conta' }}
            }
          </button>
        </form>

        <div class="my-5 flex items-center gap-3 text-zinc-600">
          <span class="flex-1 h-px bg-white/[0.06]"></span>
          <span class="text-[10.5px] uppercase tracking-widest">ou</span>
          <span class="flex-1 h-px bg-white/[0.06]"></span>
        </div>

        <button
          (click)="anonymous()"
          [disabled]="loading()"
          class="w-full py-2.5 rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] text-[13.5px] font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          Continuar como visitante
        </button>

        <p class="mt-6 text-center text-[12.5px] text-zinc-500">
          @if (mode() === 'login') {
            Não tem conta?
            <button (click)="mode.set('register'); error.set(null)" class="text-[#00FFD1] hover:underline font-medium">Cadastre-se</button>
          } @else {
            Já tem conta?
            <button (click)="mode.set('login'); error.set(null)" class="text-[#00FFD1] hover:underline font-medium">Entrar</button>
          }
        </p>
      </div>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly mode = signal<Mode>('login');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected email = '';
  protected password = '';
  protected name = '';

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (!this.email.trim() || this.password.length < 6) {
      this.error.set('Informe e-mail válido e senha de ao menos 6 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.mode() === 'login') {
        await this.auth.login(this.email, this.password);
      } else {
        await this.auth.register(this.email, this.password, this.name);
      }
      this.navigateNext();
    } catch (e: any) {
      this.error.set(this.friendly(e?.code ?? e?.message));
    } finally {
      this.loading.set(false);
    }
  }

  protected async anonymous(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginAnonymous();
      this.navigateNext();
    } catch (e: any) {
      this.error.set(this.friendly(e?.code ?? e?.message));
    } finally {
      this.loading.set(false);
    }
  }

  private navigateNext(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/map';
    this.router.navigateByUrl(redirect);
  }

  private friendly(code: string | undefined): string {
    switch (code) {
      case 'auth/invalid-email': return 'E-mail inválido.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Credenciais inválidas.';
      case 'auth/email-already-in-use': return 'E-mail já cadastrado.';
      case 'auth/weak-password': return 'Senha muito fraca (mín. 6 caracteres).';
      case 'auth/network-request-failed': return 'Falha de rede. Verifique sua conexão.';
      default: return code ?? 'Erro ao autenticar.';
    }
  }
}

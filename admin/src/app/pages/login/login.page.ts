import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'admin-login',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-shell">
      <div class="login-bg"></div>
      <div class="login-bg-glow login-bg-glow--a"></div>
      <div class="login-bg-glow login-bg-glow--b"></div>

      <div class="login-container">
        <!-- Brand block -->
        <div class="login-brand">
          <div class="brand-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 10v6"></path>
              <path d="M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24"></path>
              <path d="M1 12h6m10 0h6"></path>
              <path d="M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"></path>
            </svg>
            <span class="brand-pulse" aria-hidden="true"></span>
          </div>
          <h1 class="brand-title">PULSAR</h1>
          <p class="brand-subtitle">Console Administrativo</p>
        </div>

        <!-- Card -->
        <form class="login-card anim-slide-up" (submit)="submit($event)" novalidate>
          @if (error()) {
            <div class="error-banner" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{{ error() }}</span>
            </div>
          }

          <div class="form-group">
            <div class="input-item" [class.is-focused]="emailFocused()">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <input
                class="custom-input"
                type="email"
                name="email"
                autocomplete="username"
                inputmode="email"
                required
                placeholder="E-mail"
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                (focus)="emailFocused.set(true)"
                (blur)="emailFocused.set(false)"
                [disabled]="loading()" />
            </div>
          </div>

          <div class="form-group">
            <div class="input-item" [class.is-focused]="passwordFocused()">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input
                class="custom-input"
                [type]="showPassword() ? 'text' : 'password'"
                name="password"
                autocomplete="current-password"
                required
                placeholder="Senha"
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                (focus)="passwordFocused.set(true)"
                (blur)="passwordFocused.set(false)"
                [disabled]="loading()" />
              <button type="button" class="input-action" (click)="showPassword.set(!showPassword())"
                      [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'">
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                }
              </button>
            </div>
          </div>

          <button class="login-btn" type="submit"
                  [disabled]="loading() || !email() || !password()">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
              <span>Autenticando...</span>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>Entrar</span>
            }
          </button>

          <p class="restricted-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Acesso restrito a administradores
          </p>
        </form>

        <p class="login-footer">pulsar.app &middot; Console Administrativo</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .login-shell {
      position: relative;
      min-height: 100vh;
      min-height: 100svh;
      overflow: hidden;
      isolation: isolate;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 20px;
    }

    /* Background gradient (estrutura e-mec, paleta Pulsar) */
    .login-bg {
      position: absolute;
      inset: 0;
      z-index: -3;
      background:
        radial-gradient(circle at 18% 12%, rgba(0, 229, 255, 0.10), transparent 55%),
        radial-gradient(circle at 82% 88%, rgba(255, 56, 220, 0.08), transparent 55%),
        linear-gradient(135deg, #0a1726 0%, #060b14 50%, #08050f 100%);
    }
    .login-bg-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      z-index: -2;
      pointer-events: none;
      opacity: 0.55;
    }
    .login-bg-glow--a {
      width: 420px; height: 420px;
      top: -120px; left: -120px;
      background: radial-gradient(circle, rgba(0, 229, 255, 0.35), transparent 70%);
      animation: floatA 12s ease-in-out infinite;
    }
    .login-bg-glow--b {
      width: 480px; height: 480px;
      bottom: -160px; right: -140px;
      background: radial-gradient(circle, rgba(255, 56, 220, 0.28), transparent 70%);
      animation: floatB 16s ease-in-out infinite;
    }
    @keyframes floatA {
      0%, 100% { transform: translate(0, 0); }
      50%      { transform: translate(40px, 60px); }
    }
    @keyframes floatB {
      0%, 100% { transform: translate(0, 0); }
      50%      { transform: translate(-50px, -40px); }
    }

    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      max-width: 420px;
    }

    /* Brand */
    .login-brand {
      text-align: center;
      margin-bottom: 28px;
      color: var(--text-1);
    }
    .brand-icon-wrap {
      position: relative;
      width: 68px;
      height: 68px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(0, 229, 255, 0.18), rgba(255, 56, 220, 0.14));
      border: 1px solid rgba(0, 229, 255, 0.35);
      box-shadow:
        0 12px 30px rgba(0, 229, 255, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px;
      color: #7ef0ff;
    }
    .brand-icon-wrap svg { width: 32px; height: 32px; }
    .brand-pulse {
      position: absolute;
      inset: -4px;
      border-radius: 22px;
      border: 1px solid rgba(0, 229, 255, 0.4);
      animation: brandPulse 2.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes brandPulse {
      0%   { opacity: 0.9; transform: scale(1); }
      100% { opacity: 0;   transform: scale(1.25); }
    }
    .brand-title {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: 0.32em;
      margin: 0;
      background: linear-gradient(135deg, #fff 0%, #7ef0ff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .brand-subtitle {
      font-size: 0.7rem;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.22em;
      margin: 6px 0 0;
    }

    /* Card */
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 28px 26px 24px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(20, 28, 42, 0.86), rgba(12, 18, 28, 0.88));
      border: 1px solid var(--line);
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.02) inset;
      backdrop-filter: blur(14px) saturate(140%);
      -webkit-backdrop-filter: blur(14px) saturate(140%);
    }

    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: rgba(255, 92, 122, 0.08);
      border: 1px solid rgba(255, 92, 122, 0.28);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 16px;
      color: var(--danger);
      font-size: 12.5px;
      line-height: 1.4;
    }
    .error-banner svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

    .form-group { margin-bottom: 12px; }

    .input-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 12px;
      min-height: 50px;
      background: var(--bg-1);
      border: 1px solid var(--line);
      border-radius: 12px;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .input-item.is-focused {
      border-color: rgba(0, 229, 255, 0.55);
      background: var(--bg-2);
      box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.12);
    }
    .input-icon {
      width: 18px;
      height: 18px;
      color: var(--text-3);
      flex-shrink: 0;
      transition: color 160ms ease;
    }
    .input-item.is-focused .input-icon { color: var(--cyan); }
    .custom-input {
      flex: 1;
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-1);
      font-size: 14px;
      padding: 14px 0;
      caret-color: var(--cyan);
    }
    .custom-input::placeholder { color: var(--text-3); }
    .custom-input:disabled { opacity: 0.6; }

    .input-action {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: transparent;
      border: none;
      color: var(--text-3);
      cursor: pointer;
      transition: background 140ms ease, color 140ms ease;
    }
    .input-action:hover { background: var(--bg-2); color: var(--text-1); }
    .input-action svg { width: 16px; height: 16px; }

    .login-btn {
      width: 100%;
      height: 50px;
      border-radius: 12px;
      border: 1px solid transparent;
      background: linear-gradient(135deg, var(--cyan) 0%, #00b8d4 100%);
      color: #001218;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.04em;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 8px;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 200ms ease, filter 160ms ease;
      box-shadow: 0 10px 30px rgba(0, 229, 255, 0.28);
    }
    .login-btn svg { width: 18px; height: 18px; }
    .login-btn:hover:not(:disabled) {
      filter: brightness(1.06);
      box-shadow: 0 14px 36px rgba(0, 229, 255, 0.38);
      transform: translateY(-1px);
    }
    .login-btn:active:not(:disabled) { transform: translateY(0); }
    .login-btn:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(0, 18, 24, 0.3);
      border-top-color: #001218;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .restricted-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 16px 0 0;
      font-size: 11.5px;
      color: var(--text-3);
      letter-spacing: 0.02em;
    }
    .restricted-note svg { width: 13px; height: 13px; color: var(--text-3); }

    .login-footer {
      margin-top: 28px;
      color: rgba(255, 255, 255, 0.28);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-align: center;
    }

    @media (max-width: 420px) {
      .login-shell { padding: 16px; }
      .login-card { padding: 24px 20px 20px; border-radius: 16px; }
      .brand-title { font-size: 1.4rem; letter-spacing: 0.28em; }
    }

    @media (prefers-reduced-motion: reduce) {
      .brand-pulse,
      .login-bg-glow--a,
      .login-bg-glow--b { animation: none; }
    }
  `],
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);
  emailFocused = signal(false);
  passwordFocused = signal(false);

  async submit(ev: Event) {
    ev.preventDefault();
    if (this.loading()) return;

    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Preencha e-mail e senha.');
      return;
    }

    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(email, password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
      this.router.navigateByUrl(redirect);
    } catch (err: any) {
      const code: string = err?.code ?? '';
      if (err?.message?.includes('admin')) {
        this.error.set('Esta conta não tem privilégios de administrador.');
      } else if (
        code.includes('invalid-credential') ||
        code.includes('wrong-password') ||
        code.includes('user-not-found')
      ) {
        this.error.set('E-mail ou senha incorretos.');
      } else if (code.includes('too-many-requests')) {
        this.error.set('Muitas tentativas. Tente novamente em alguns minutos.');
      } else if (code.includes('network')) {
        this.error.set('Falha de rede. Verifique sua conexão.');
      } else {
        this.error.set('Falha no login. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}

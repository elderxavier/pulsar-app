import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  isRegister = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  async submit() {
    if (!this.email.includes('@') || this.password.length < 6) return;
    this.loading.set(true); this.error.set(null);
    try {
      if (this.isRegister()) await this.auth.register(this.email.trim(), this.password);
      else await this.auth.login(this.email.trim(), this.password);
      this.router.navigate(['/map']);
    } catch (e: any) {
      this.error.set(this.mapError(e.code));
    } finally { this.loading.set(false); }
  }

  async loginGoogle() {
    this.loading.set(true); this.error.set(null);
    try {
      await this.auth.loginWithGoogle();
      this.router.navigate(['/map']);
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        this.error.set('Erro no login com Google: ' + (e.message ?? ''));
      }
    } finally { this.loading.set(false); }
  }

  private mapError(code: string): string {
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email ou senha incorretos.';
    if (code === 'auth/email-already-in-use') return 'Este email já está em uso.';
    if (code === 'auth/weak-password') return 'Senha muito fraca (mínimo 6 caracteres).';
    if (code === 'auth/invalid-email') return 'Email inválido.';
    return 'Erro ao autenticar. Tente novamente.';
  }
}

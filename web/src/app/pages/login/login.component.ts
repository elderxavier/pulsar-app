import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal('');
  isRegister = signal(false);
  loading = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
    this.error.set('');
    this.loading.set(true);
    try {
      if (this.isRegister()) {
        await this.auth.register(this.email, this.password);
      } else {
        await this.auth.login(this.email, this.password);
      }
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.error.set(e.message ?? 'Erro ao autenticar.');
    } finally {
      this.loading.set(false);
    }
  }
}

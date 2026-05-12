import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="pulsar-ambient"></div>
    <router-outlet />
  `,
})
export class App implements OnInit {
  private auth = inject(AuthService);

  ngOnInit(): void {
    // força bootstrap do AuthService (anonymous bypass etc.)
    this.auth.bootstrap();
  }
}

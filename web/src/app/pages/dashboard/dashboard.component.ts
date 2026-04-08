import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { PostsService, Post } from '../../core/posts.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  posts = signal<Post[]>([]);
  private unsub?: Unsubscribe;

  constructor(
    public auth: AuthService,
    private postsService: PostsService,
    private router: Router
  ) {}

  ngOnInit() {
    this.unsub = this.postsService.listenActivePosts((posts) => {
      this.posts.set(posts);
    });
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  timeRemaining(expiresAt: any): string {
    const now = Date.now();
    const exp = expiresAt.toMillis();
    const diff = exp - now;
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  formatCoords(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

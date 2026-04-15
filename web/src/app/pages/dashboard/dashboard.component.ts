import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { PostsService, Post } from '../../core/posts.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  posts = signal<Post[]>([]);
  searchQuery = '';
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  activeTab = signal<'radar' | 'posts' | 'promo'>('radar');
  private unsub?: Unsubscribe;

  filteredPosts = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const all = this.posts();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q)
    );
  });

  expiringSoon = computed(() => {
    const oneHour = 3600000;
    return this.posts().filter(
      (p) => p.expiresAt.toMillis() - Date.now() < oneHour && p.expiresAt.toMillis() - Date.now() > 0
    ).length;
  });

  uniqueUsers = computed(() => {
    return new Set(this.posts().map((p) => p.userId)).size;
  });

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

  ttlPercent(expiresAt: any, createdAt: any): number {
    const now = Date.now();
    const total = expiresAt.toMillis() - createdAt.toMillis();
    const remaining = expiresAt.toMillis() - now;
    if (remaining <= 0) return 0;
    return Math.round((remaining / total) * 100);
  }

  formatCoords(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  relativeTime(createdAt: any): string {
    const diff = Date.now() - createdAt.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    return `${hours}h atrás`;
  }
}

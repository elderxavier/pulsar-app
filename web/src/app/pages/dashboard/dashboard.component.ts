import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Unsubscribe, Timestamp } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { PostsService, Post } from '../../core/posts.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private postsService = inject(PostsService);
  private router = inject(Router);

  posts = signal<Post[]>([]);
  searchQuery = '';
  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  activeTab = signal<'radar' | 'posts' | 'promo'>('radar');

  editingId = signal<string | null>(null);
  editContent = '';

  private unsub?: Unsubscribe;

  filteredPosts = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const all = this.posts();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q)
    );
  });

  expiringSoon = computed(() => {
    const oneHour = 3600000;
    return this.posts().filter(
      (p) => p.expiresAt.toMillis() - Date.now() < oneHour && p.expiresAt.toMillis() - Date.now() > 0
    ).length;
  });

  uniqueUsers = computed(() => new Set(this.posts().map((p) => p.userId)).size);

  ngOnInit() {
    this.unsub = this.postsService.listenActivePosts((posts) => this.posts.set(posts));
  }

  ngOnDestroy() {
    this.unsub?.();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  isOwner(p: Post): boolean {
    return this.auth.currentUser()?.uid === p.userId;
  }

  startEdit(p: Post) {
    this.editingId.set(p.id);
    this.editContent = p.content;
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  async saveEdit(p: Post) {
    const content = this.editContent.trim();
    if (!content) return;
    try {
      await this.postsService.updatePost(p.id, content);
      this.editingId.set(null);
    } catch (e: any) {
      alert('Erro ao editar: ' + (e?.message ?? e));
    }
  }

  async deletePost(p: Post) {
    if (!confirm('Excluir este pulso? Esta ação não pode ser desfeita.')) return;
    try {
      await this.postsService.deletePost(p.id);
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e?.message ?? e));
    }
  }

  timeRemaining(expiresAt: Timestamp): string {
    const diff = expiresAt.toMillis() - Date.now();
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  ttlPercent(expiresAt: Timestamp, createdAt: Timestamp): number {
    const now = Date.now();
    const total = expiresAt.toMillis() - createdAt.toMillis();
    const remaining = expiresAt.toMillis() - now;
    if (remaining <= 0 || total <= 0) return 0;
    return Math.round((remaining / total) * 100);
  }

  formatCoords(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  relativeTime(createdAt: Timestamp): string {
    const diff = Date.now() - createdAt.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    return `${hours}h atrás`;
  }
}

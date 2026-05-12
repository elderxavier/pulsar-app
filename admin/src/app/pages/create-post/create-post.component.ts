import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostsService } from '../../core/posts.service';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-post.component.html',
})
export class CreatePostComponent {
  private posts = inject(PostsService);
  router = inject(Router);

  title = '';
  content = '';
  imageUrl = '';
  loc = signal<{ lat: number; lng: number } | null>(null);
  startDate = signal(toLocalInput(new Date()));
  endDate = signal(toLocalInput(new Date(Date.now() + 6 * 3_600_000)));
  saving = signal(false);
  error = signal<string | null>(null);

  durationLabel = computed(() => {
    const ms = new Date(this.endDate()).getTime() - new Date(this.startDate()).getTime();
    if (ms <= 0) return 'inválido';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  });

  constructor() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        p => this.loc.set({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => this.error.set('Não foi possível obter localização: ' + e.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }

  async submit() {
    const loc = this.loc();
    if (!loc || !this.content.trim()) return;
    this.saving.set(true); this.error.set(null);
    try {
      await this.posts.createPost({
        title: this.title.trim(),
        content: this.content.trim(),
        latitude: loc.lat,
        longitude: loc.lng,
        startsAt: new Date(this.startDate()),
        expiresAt: new Date(this.endDate()),
        imageUrl: this.imageUrl.trim() || undefined,
      });
      this.router.navigate(['/map']);
    } catch (e: any) {
      this.error.set('Erro ao publicar: ' + (e.message ?? ''));
    } finally { this.saving.set(false); }
  }
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

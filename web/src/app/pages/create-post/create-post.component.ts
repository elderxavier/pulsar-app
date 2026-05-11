import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PostsService } from '../../core/posts.service';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-post.component.html',
})
export class CreatePostComponent implements OnInit, OnDestroy {
  private postsService = inject(PostsService);
  private router = inject(Router);

  title = '';
  content = '';
  startsAt = this.toLocalInputValue(new Date());
  expiresAt = this.toLocalInputValue(new Date(Date.now() + 6 * 3600_000));

  location = signal<{ lat: number; lng: number } | null>(null);
  locationError = signal<string | null>(null);

  imageUrl = signal<string | null>(null);
  videoUrl = signal<string | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  durationLabel = computed(() => {
    const ms = new Date(this.expiresAt).getTime() - new Date(this.startsAt).getTime();
    if (ms <= 0) return '';
    const h = ms / 3600_000;
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (Number.isInteger(h)) return `${h}h`;
    return `${h.toFixed(1)}h`;
  });

  isValidDuration = computed(
    () => new Date(this.expiresAt).getTime() > new Date(this.startsAt).getTime()
  );

  canSubmit = computed(
    () =>
      !this.loading() &&
      this.content.trim().length > 0 &&
      this.content.trim().length <= 280 &&
      !!this.location() &&
      this.isValidDuration()
  );

  ngOnInit() {
    if (!navigator.geolocation) {
      this.locationError.set('Geolocalização não suportada neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => this.location.set({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => this.locationError.set('Localização indisponível: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  ngOnDestroy() {
    this.revokeUrls();
  }

  onImageSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearVideo();
    this.imageUrl.set(URL.createObjectURL(file));
  }

  onVideoSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearImage();
    this.videoUrl.set(URL.createObjectURL(file));
  }

  clearImage() {
    const url = this.imageUrl();
    if (url) URL.revokeObjectURL(url);
    this.imageUrl.set(null);
  }

  clearVideo() {
    const url = this.videoUrl();
    if (url) URL.revokeObjectURL(url);
    this.videoUrl.set(null);
  }

  private revokeUrls() {
    [this.imageUrl(), this.videoUrl()].forEach((u) => u && URL.revokeObjectURL(u));
  }

  async submit() {
    if (!this.canSubmit()) return;
    const loc = this.location();
    if (!loc) return;

    this.loading.set(true);
    this.error.set(null);
    try {
      await this.postsService.createPost({
        title: this.title.trim(),
        content: this.content.trim(),
        latitude: loc.lat,
        longitude: loc.lng,
        startsAt: new Date(this.startsAt),
        expiresAt: new Date(this.expiresAt),
        imageUrl: this.imageUrl() ?? '',
        videoUrl: this.videoUrl() ?? '',
      });
      this.router.navigate(['/map']);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Erro ao publicar.');
    } finally {
      this.loading.set(false);
    }
  }

  cancel() {
    this.router.navigate(['/map']);
  }

  private toLocalInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

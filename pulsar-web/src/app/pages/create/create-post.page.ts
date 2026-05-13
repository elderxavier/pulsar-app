import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PostsService } from '../../core/posts.service';
import { GeoLocationService } from '../../core/geolocation.service';
import { AuthService } from '../../core/auth.service';

interface DurationOption { hours: number; label: string; }

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="min-h-[calc(100dvh-3.5rem)] md:min-h-dvh w-full max-w-3xl mx-auto px-4 sm:px-5 py-6 lg:py-10 relative safe-pb">
      <div class="pulsar-ambient"></div>

      <header class="flex items-start justify-between mb-7 gap-3">
        <div class="min-w-0">
          <p class="text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">novo</p>
          <h1 class="text-[22px] sm:text-[26px] font-semibold mt-0.5">Criar Pulso</h1>
          <p class="text-zinc-500 text-[13px] mt-1">Compartilhe algo efêmero no seu raio local.</p>
        </div>
        <button
          (click)="cancel()"
          class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/[0.04] text-zinc-400 shrink-0"
          aria-label="Cancelar"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round"/>
          </svg>
        </button>
      </header>

      <form (ngSubmit)="submit()" class="space-y-5 relative z-10">
        <!-- Título -->
        <div>
          <label class="block text-[11.5px] font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Título <span class="text-zinc-600 normal-case tracking-normal">(opcional)</span></label>
          <input
            type="text"
            [(ngModel)]="title"
            name="title"
            maxlength="100"
            placeholder="Um título curto e direto"
            class="w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-zinc-600"
          />
        </div>

        <!-- Conteúdo -->
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <label class="text-[11.5px] font-medium text-zinc-400 uppercase tracking-wider">Conteúdo</label>
            <span
              class="text-[10.5px] font-mono"
              [class.text-zinc-500]="content.length < 240"
              [class.text-\[\#FFB547\]]="content.length >= 240 && content.length < 280"
              [class.text-\[\#FF4D6D\]]="content.length >= 280"
            >{{ content.length }} / 280</span>
          </div>
          <textarea
            [(ngModel)]="content"
            name="content"
            rows="5"
            maxlength="280"
            placeholder="O que está acontecendo aqui agora?"
            class="w-full bg-[#0B0D12] border border-white/[0.08] focus:border-[#00FFD1] rounded-lg px-3.5 py-3 text-[14px] outline-none resize-none transition-colors placeholder:text-zinc-600"
          ></textarea>
        </div>

        <!-- Duração -->
        <div>
          <label class="block text-[11.5px] font-medium text-zinc-400 mb-2 uppercase tracking-wider">Duração</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            @for (opt of durations; track opt.hours) {
              <button
                type="button"
                (click)="durationHours.set(opt.hours)"
                class="px-3 py-2 rounded-lg text-[12.5px] font-medium border transition-all"
                [class.bg-\[\#00FFD1\]]="durationHours() === opt.hours"
                [class.text-\[\#06070A\]]="durationHours() === opt.hours"
                [class.border-\[\#00FFD1\]]="durationHours() === opt.hours"
                [class.bg-white\/\[0\.02\]]="durationHours() !== opt.hours"
                [class.border-white\/\[0\.08\]]="durationHours() !== opt.hours"
                [class.text-zinc-400]="durationHours() !== opt.hours"
              >{{ opt.label }}</button>
            }
          </div>
          <p class="text-[11px] text-zinc-500 mt-2">Expira em <span class="text-zinc-300 font-medium">{{ expiresAtLabel() }}</span></p>
        </div>

        <!-- Localização -->
        <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-lg bg-[#00FFD1]/10 border border-[#00FFD1]/20 flex items-center justify-center text-[#00FFD1] shrink-0">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-white">Localização atual</p>
              @if (geo.location(); as loc) {
                <p class="text-[11.5px] text-zinc-500 font-mono mt-0.5">{{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}</p>
              } @else if (geo.loading()) {
                <p class="text-[11.5px] text-zinc-500 mt-0.5">obtendo coordenadas…</p>
              } @else {
                <p class="text-[11.5px] text-[#FFB547] mt-0.5">{{ geo.error() ?? 'localização indisponível' }}</p>
              }
            </div>
            <button
              type="button"
              (click)="refreshLocation()"
              class="text-[11.5px] text-[#00FFD1] hover:underline shrink-0"
            >Atualizar</button>
          </div>
        </div>

        <!-- Erro -->
        @if (errorMessage(); as err) {
          <div class="rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/8 px-3.5 py-2.5 text-[12.5px] text-[#FF4D6D]">
            {{ err }}
          </div>
        }

        <!-- Ações -->
        <div class="flex gap-2.5 pt-2">
          <button
            type="button"
            (click)="cancel()"
            class="flex-1 py-3 rounded-lg border border-white/[0.1] text-zinc-300 text-[13px] font-medium hover:bg-white/[0.03] min-h-[48px]"
          >Cancelar</button>
          <button
            type="submit"
            [disabled]="submitting() || !canSubmit()"
            class="flex-[2] py-3 rounded-lg bg-[#00FFD1] text-[#06070A] font-semibold text-[13px] hover:bg-[#00E0B8] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            @if (submitting()) {
              <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
              </svg>
              Publicando…
            } @else {
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Publicar pulso
            }
          </button>
        </div>
      </form>
    </section>
  `,
})
export class CreatePostPage {
  protected readonly geo = inject(GeoLocationService);
  protected readonly auth = inject(AuthService);
  private readonly posts = inject(PostsService);
  private readonly router = inject(Router);

  protected title = '';
  protected content = '';
  protected readonly durationHours = signal(6);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly durations: ReadonlyArray<DurationOption> = [
    { hours: 1, label: '1 hora' },
    { hours: 6, label: '6 horas' },
    { hours: 12, label: '12 horas' },
    { hours: 24, label: '24 horas' },
  ];

  protected readonly expiresAtLabel = computed(() => {
    const d = new Date(Date.now() + this.durationHours() * 3_600_000);
    return d.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  });

  protected readonly canSubmit = computed(() =>
    this.content.trim().length > 0 && this.geo.location() !== null
  );

  constructor() {
    if (!this.geo.location()) {
      this.geo.request().catch(() => { /* erro mostrado via signal */ });
    }
  }

  protected refreshLocation(): void {
    this.geo.request().catch(() => {});
  }

  protected cancel(): void {
    this.router.navigate(['/map']);
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    const loc = this.geo.location();
    if (!loc) {
      this.errorMessage.set('Localização obrigatória. Permita o acesso à sua localização.');
      return;
    }
    if (!this.content.trim()) {
      this.errorMessage.set('Escreva algo no conteúdo.');
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const now = new Date();
      await this.posts.createPost({
        title: this.title,
        content: this.content,
        latitude: loc.lat,
        longitude: loc.lng,
        startsAt: now,
        expiresAt: new Date(now.getTime() + this.durationHours() * 3_600_000),
      });
      await this.router.navigate(['/map']);
    } catch (e: any) {
      this.errorMessage.set(e?.message ?? 'Erro ao publicar.');
    } finally {
      this.submitting.set(false);
    }
  }
}

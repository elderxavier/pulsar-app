import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService, type GlobalConfig } from '../../core/config.service';

@Component({
  selector: 'admin-settings',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-5 anim-fade-in max-w-3xl">
      <header>
        <h1 class="text-xl font-semibold tracking-tight">Configurações globais</h1>
        <p class="text-[12.5px] text-text-3">Aplicado a todos os clients via doc <code class="kbd">/config/global</code>.</p>
      </header>

      @if (cfg(); as c) {
        <form class="surface rounded-xl p-5 space-y-5" (submit)="save($event)">
          <!-- Kill-switch -->
          <div class="flex items-center justify-between gap-4 pb-4 border-b border-white/6">
            <div>
              <div class="text-sm font-medium">Criação de posts</div>
              <p class="text-[11.5px] text-text-3">Desabilite em emergências para parar toda criação no app.</p>
            </div>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" [(ngModel)]="c.postsEnabled" name="postsEnabled" class="w-4 h-4 accent-cyan">
              <span class="text-sm" [class.text-success]="c.postsEnabled" [class.text-danger]="!c.postsEnabled">
                {{ c.postsEnabled ? 'Habilitado' : 'BLOQUEADO' }}
              </span>
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">TTL padrão (horas)</label>
              <input class="input" type="number" min="1" max="72" [(ngModel)]="c.defaultPostTtlHours" name="ttl">
              <p class="text-[10.5px] text-text-3 mt-1">1 – 72</p>
            </div>
            <div>
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">Tamanho máximo do post</label>
              <input class="input" type="number" min="50" max="2000" [(ngModel)]="c.maxContentLength" name="maxLen">
            </div>
            <div>
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">Raio mínimo (km)</label>
              <input class="input" type="number" min="0.1" max="100" step="0.1" [(ngModel)]="c.minRadiusKm" name="minR">
            </div>
            <div>
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">Raio máximo (km)</label>
              <input class="input" type="number" min="1" max="500" [(ngModel)]="c.maxRadiusKm" name="maxR">
            </div>
            <div class="md:col-span-2">
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">Posts por usuário / 24h</label>
              <input class="input" type="number" min="1" max="1000" [(ngModel)]="c.postsPerUserPerDay" name="ppu">
            </div>
            <div class="md:col-span-2">
              <label class="text-[11px] uppercase tracking-wider text-text-3 mb-1.5 block">Banner global (opcional)</label>
              <textarea class="textarea" [(ngModel)]="c.bannerMessage" name="banner" maxlength="280" rows="2"></textarea>
              <p class="text-[10.5px] text-text-3 mt-1">{{ c.bannerMessage.length }} / 280</p>
            </div>
          </div>

          <div class="flex justify-between items-center pt-4 border-t border-white/6">
            <div class="text-[11px] text-text-3">
              @if (c.updatedAt) {
                Atualizado {{ formatDate(c.updatedAt.toMillis()) }} por <code class="kbd">{{ c.updatedBy }}</code>
              } @else {
                Nunca alterado (defaults)
              }
            </div>
            <div class="flex gap-2">
              <button type="button" class="btn btn-ghost" (click)="reset()" [disabled]="saving()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                {{ saving() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </div>

          @if (savedAt(); as t) {
            <div class="text-[11.5px] text-success">Salvo às {{ formatDate(t) }}.</div>
          }
        </form>
      } @else {
        <div class="skeleton h-64 rounded-xl"></div>
      }
    </section>
  `,
})
export class SettingsPage implements OnInit, OnDestroy {
  private svc = inject(ConfigService);
  cfg = signal<GlobalConfig | null>(null);
  private original: GlobalConfig | null = null;
  saving = signal(false);
  savedAt = signal<number | null>(null);
  private unsub?: () => void;

  ngOnInit() {
    this.unsub = this.svc.listen((c) => {
      this.original = { ...c };
      this.cfg.set({ ...c });
    });
  }
  ngOnDestroy() { this.unsub?.(); }

  reset() {
    if (this.original) this.cfg.set({ ...this.original });
  }

  async save(ev: Event) {
    ev.preventDefault();
    const c = this.cfg();
    if (!c || this.saving()) return;
    this.saving.set(true);
    try {
      await this.svc.update({
        defaultPostTtlHours: c.defaultPostTtlHours,
        minRadiusKm: c.minRadiusKm,
        maxRadiusKm: c.maxRadiusKm,
        maxContentLength: c.maxContentLength,
        postsPerUserPerDay: c.postsPerUserPerDay,
        postsEnabled: c.postsEnabled,
        bannerMessage: c.bannerMessage,
      });
      this.savedAt.set(Date.now());
    } catch (err) {
      console.error(err);
      alert('Falha ao salvar. Verifique permissões.');
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(ms: number) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(ms));
  }
}

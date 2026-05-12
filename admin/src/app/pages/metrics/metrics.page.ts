import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetricsService, type TimeSeriesPoint } from '../../core/metrics.service';

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  count: number;
  label: string;
}

@Component({
  selector: 'admin-metrics',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-5 lg:p-7 space-y-5 anim-fade-in">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Métricas</h1>
          <p class="text-[12.5px] text-text-3">Posts criados nas últimas {{ hours() }}h.</p>
        </div>
        <select class="select" [(ngModel)]="hoursStr" (ngModelChange)="reload()" style="min-width: 140px">
          <option value="6">Últimas 6h</option>
          <option value="12">Últimas 12h</option>
          <option value="24">Últimas 24h</option>
          <option value="48">Últimas 48h</option>
          <option value="72">Últimas 72h</option>
        </select>
      </header>

      <div class="surface rounded-xl p-5">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-[10.5px] uppercase tracking-wider text-text-3">Total no período</div>
            <div class="text-3xl font-semibold tabular-nums">{{ total() }}</div>
          </div>
          <div class="text-right">
            <div class="text-[10.5px] uppercase tracking-wider text-text-3">Pico/h</div>
            <div class="text-lg font-medium tabular-nums">{{ peak() }}</div>
          </div>
        </div>

        @if (series().length > 0) {
          <svg class="w-full" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" style="height: 280px">
            <!-- Eixos -->
            <line [attr.x1]="PAD_L" [attr.x2]="W - PAD_R" [attr.y1]="H - PAD_B" [attr.y2]="H - PAD_B" stroke="#232734" stroke-width="1"/>
            @for (g of gridLines(); track g) {
              <line [attr.x1]="PAD_L" [attr.x2]="W - PAD_R" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#181C26" stroke-width="1" stroke-dasharray="2 3"/>
              <text [attr.x]="PAD_L - 8" [attr.y]="g.y + 3" text-anchor="end" fill="#6B7180" font-size="10" font-family="ui-monospace">{{ g.label }}</text>
            }
            <!-- Barras -->
            @for (b of bars(); track b.x) {
              <rect
                [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h"
                fill="#00FFD1" opacity="0.85" rx="2">
                <title>{{ b.label }} — {{ b.count }}</title>
              </rect>
            }
            <!-- Labels eixo X -->
            @for (l of xLabels(); track l.x) {
              <text [attr.x]="l.x" [attr.y]="H - PAD_B + 14" text-anchor="middle" fill="#6B7180" font-size="9.5" font-family="ui-monospace">{{ l.label }}</text>
            }
          </svg>
        } @else {
          <div class="h-72 flex items-center justify-center text-text-3 text-sm">Sem dados.</div>
        }
      </div>
    </section>
  `,
})
export class MetricsPage implements OnInit {
  private svc = inject(MetricsService);
  readonly W = 800;
  readonly H = 280;
  readonly PAD_L = 38;
  readonly PAD_R = 12;
  readonly PAD_T = 12;
  readonly PAD_B = 22;

  hoursStr = signal('24');
  hours = computed(() => Number(this.hoursStr()));
  series = signal<TimeSeriesPoint[]>([]);

  total = computed(() => this.series().reduce((s, p) => s + p.count, 0));
  peak = computed(() => this.series().reduce((m, p) => Math.max(m, p.count), 0));

  bars = computed<Bar[]>(() => {
    const pts = this.series();
    if (pts.length === 0) return [];
    const max = Math.max(1, this.peak());
    const plotW = this.W - this.PAD_L - this.PAD_R;
    const plotH = this.H - this.PAD_T - this.PAD_B;
    const slot = plotW / pts.length;
    const w = Math.max(2, slot * 0.7);
    return pts.map((p, i) => {
      const h = (p.count / max) * plotH;
      return {
        x: this.PAD_L + i * slot + (slot - w) / 2,
        y: this.H - this.PAD_B - h,
        w, h,
        count: p.count,
        label: new Date(p.bucket).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      };
    });
  });

  gridLines = computed(() => {
    const max = Math.max(1, this.peak());
    const plotH = this.H - this.PAD_T - this.PAD_B;
    const steps = 4;
    const out: { y: number; label: string }[] = [];
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((max * i) / steps);
      out.push({
        y: this.H - this.PAD_B - (val / max) * plotH,
        label: String(val),
      });
    }
    return out;
  });

  xLabels = computed(() => {
    const bars = this.bars();
    if (bars.length === 0) return [];
    const step = Math.max(1, Math.floor(bars.length / 6));
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < bars.length; i += step) {
      const b = bars[i];
      const date = new Date(this.series()[i].bucket);
      out.push({
        x: b.x + b.w / 2,
        label: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    return out;
  });

  ngOnInit() { this.reload(); }

  async reload() {
    try {
      const pts = await this.svc.postsTimeSeries(this.hours());
      this.series.set(pts);
    } catch (err) {
      console.error('[Metrics] reload', err);
      this.series.set([]);
    }
  }
}

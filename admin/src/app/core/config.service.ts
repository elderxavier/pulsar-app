import { Injectable, inject } from '@angular/core';
import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { fbDb } from './firebase';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';

export interface GlobalConfig {
  /** TTL padrão do post em horas (1..72) */
  defaultPostTtlHours: number;
  /** Raio mínimo/máximo do feed em km */
  minRadiusKm: number;
  maxRadiusKm: number;
  /** Tamanho máximo do conteúdo em chars */
  maxContentLength: number;
  /** Limite de posts por usuário em 24h */
  postsPerUserPerDay: number;
  /** Habilita criação de posts (kill-switch) */
  postsEnabled: boolean;
  /** Mensagem global exibida no app (banner) */
  bannerMessage: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

const DEFAULT: GlobalConfig = {
  defaultPostTtlHours: 6,
  minRadiusKm: 1,
  maxRadiusKm: 50,
  maxContentLength: 280,
  postsPerUserPerDay: 30,
  postsEnabled: true,
  bannerMessage: '',
};

const CONFIG_PATH = 'config/global';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private auth = inject(AuthService);
  private audit = inject(AuditService);

  listen(callback: (cfg: GlobalConfig) => void): Unsubscribe {
    return onSnapshot(doc(fbDb(), CONFIG_PATH), (snap) => {
      const data = snap.data() as Partial<GlobalConfig> | undefined;
      callback({ ...DEFAULT, ...(data ?? {}) });
    }, (err) => {
      console.warn('[Config] erro lendo /config/global, usando default', err);
      callback(DEFAULT);
    });
  }

  async update(patch: Partial<GlobalConfig>): Promise<void> {
    const user = this.auth.user();
    const sanitized = this.sanitize(patch);
    await setDoc(doc(fbDb(), CONFIG_PATH), {
      ...sanitized,
      updatedAt: Timestamp.now(),
      updatedBy: user?.uid ?? 'unknown',
    }, { merge: true });
    await this.audit.log({
      action: 'config.update',
      target: 'global',
      reason: JSON.stringify(sanitized),
    });
  }

  private sanitize(p: Partial<GlobalConfig>): Partial<GlobalConfig> {
    const out: Partial<GlobalConfig> = {};
    if (p.defaultPostTtlHours !== undefined) out.defaultPostTtlHours = clamp(p.defaultPostTtlHours, 1, 72);
    if (p.minRadiusKm !== undefined) out.minRadiusKm = clamp(p.minRadiusKm, 0.1, 100);
    if (p.maxRadiusKm !== undefined) out.maxRadiusKm = clamp(p.maxRadiusKm, 1, 500);
    if (p.maxContentLength !== undefined) out.maxContentLength = clamp(p.maxContentLength, 50, 2000);
    if (p.postsPerUserPerDay !== undefined) out.postsPerUserPerDay = clamp(p.postsPerUserPerDay, 1, 1000);
    if (p.postsEnabled !== undefined) out.postsEnabled = p.postsEnabled === true;
    if (p.bannerMessage !== undefined) out.bannerMessage = String(p.bannerMessage).slice(0, 280);
    return out;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

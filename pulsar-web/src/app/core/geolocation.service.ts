import { Injectable, signal } from '@angular/core';
import type { LatLng } from './geo.util';

@Injectable({ providedIn: 'root' })
export class GeoLocationService {
  readonly location = signal<LatLng | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  private watchId: number | null = null;

  request(opts: PositionOptions = { enableHighAccuracy: true, timeout: 12_000 }): Promise<LatLng> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const err = 'Geolocalização não suportada.';
        this.error.set(err);
        reject(new Error(err));
        return;
      }
      this.loading.set(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this.location.set(loc);
          this.error.set(null);
          this.loading.set(false);
          resolve(loc);
        },
        (e) => {
          this.error.set(this.errorMessage(e));
          this.loading.set(false);
          reject(e);
        },
        opts
      );
    });
  }

  watch(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    this.stop();
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.location.set({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (e) => this.error.set(this.errorMessage(e)),
      { enableHighAccuracy: true, maximumAge: 15_000 }
    );
  }

  stop(): void {
    if (this.watchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private errorMessage(e: GeolocationPositionError): string {
    switch (e.code) {
      case e.PERMISSION_DENIED:
        return 'Permissão de localização negada.';
      case e.POSITION_UNAVAILABLE:
        return 'Localização indisponível no momento.';
      case e.TIMEOUT:
        return 'Tempo esgotado ao buscar localização.';
      default:
        return e.message || 'Erro ao obter localização.';
    }
  }
}

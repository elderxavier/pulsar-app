import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { effect } from '@angular/core';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return new Promise<boolean>((resolve) => {
    const stop = effect(() => {
      if (auth.loading()) return;
      if (auth.currentUser()) { resolve(true); }
      else { router.navigate(['/login']); resolve(false); }
      queueMicrotask(() => stop.destroy());
    });
  });
};

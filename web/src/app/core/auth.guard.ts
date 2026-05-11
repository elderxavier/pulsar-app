import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!environment.production && environment.bypassAuth) {
    return true;
  }

  if (auth.currentUser()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

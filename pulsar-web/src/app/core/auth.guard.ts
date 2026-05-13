import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!environment.production && environment.bypassAuth) return true;
  if (auth.user()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: state.url !== '/' ? { redirect: state.url } : undefined,
  });
};

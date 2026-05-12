import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/** Bloqueia rotas se não autenticado OU se não tiver claim admin=true. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user() && auth.isAdmin()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: state.url !== '/' ? { redirect: state.url } : undefined,
  });
};

/** Específico para áreas de superadmin (settings críticas). */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.user() && auth.isSuperAdmin()) return true;
  return router.createUrlTree(['/dashboard']);
};

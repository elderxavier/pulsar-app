import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'map' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'map',
        loadComponent: () => import('./pages/map/map.page').then((m) => m.MapPage),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'create',
        loadComponent: () => import('./pages/create/create-post.page').then((m) => m.CreatePostPage),
      },
    ],
  },
  { path: '**', redirectTo: 'map' },
];

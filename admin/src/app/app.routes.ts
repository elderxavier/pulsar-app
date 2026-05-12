import { Routes } from '@angular/router';
import { adminGuard, superAdminGuard } from './core/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'posts',
        loadComponent: () => import('./pages/posts/posts.page').then((m) => m.PostsPage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'settings',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs.page').then((m) => m.LogsPage),
      },
      {
        path: 'metrics',
        loadComponent: () => import('./pages/metrics/metrics.page').then((m) => m.MetricsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

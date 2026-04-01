import { Routes } from '@angular/router';

export const routes: Routes = [
  // Default: send new visitors to the dashboard list
  {
    path: '',
    redirectTo: 'dashboards',
    pathMatch: 'full'
  },
  // Dashboard list page
  {
    path: 'dashboards',
    loadComponent: () =>
      import('./components/dashboard-list/dashboard-list')
        .then(m => m.DashboardList)
  },
  // Builder — optional :id param (no ID = use the registry's active dashboard)
  {
    path: 'builder',
    loadComponent: () =>
      import('./components/canvas/canvas')
        .then(m => m.Canvas)
  },
  {
    path: 'builder/:id',
    loadComponent: () =>
      import('./components/canvas/canvas')
        .then(m => m.Canvas)
  },
  // View — both /view and /view/:id load the same component
  {
    path: 'view',
    loadComponent: () =>
      import('./components/dashboard-view/dashboard-view')
        .then(m => m.DashboardView)
  },
  {
    path: 'view/:id',
    loadComponent: () =>
      import('./components/dashboard-view/dashboard-view')
        .then(m => m.DashboardView)
  },
  // Wildcard — redirect to list rather than builder so stale bookmarks
  // don't silently open a blank canvas
  {
    path: '**',
    redirectTo: 'dashboards'
  }
];
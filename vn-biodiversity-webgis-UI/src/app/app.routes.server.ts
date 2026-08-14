import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'species-list',
    renderMode: RenderMode.Client,
  },
  {
    path: 'taxonomy',
    renderMode: RenderMode.Client,
  },
  {
    path: 'map',
    renderMode: RenderMode.Client,
  },
  {
    path: 'statistics',
    renderMode: RenderMode.Client,
  },
  {
    path: 'endangered-species',
    renderMode: RenderMode.Client,
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'login',
    renderMode: RenderMode.Client,
  },
  {
    path: 'species/:sourceTable/:speciesId',
    renderMode: RenderMode.Server,
  },
  {
    path: 'map/national-park/:parkId',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender,
  },
];

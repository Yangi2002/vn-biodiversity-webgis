import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
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

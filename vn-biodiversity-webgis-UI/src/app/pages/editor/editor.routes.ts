import { Routes } from '@angular/router';
import { adminPermissionGuard } from '../../core/auth/admin-permission.guard';
import { EditorWorkspacePage } from './workspace/editor-workspace.page';

export const editorRoutes: Routes = [
  { path: '', component: EditorWorkspacePage, data: { mode: 'overview' } },
  {
    path: 'import',
    component: EditorWorkspacePage,
    canActivate: [adminPermissionGuard],
    data: { mode: 'import', permissions: ['data.import'] },
  },
  {
    path: 'species/new',
    component: EditorWorkspacePage,
    canActivate: [adminPermissionGuard],
    data: { mode: 'create', permissions: ['species.create'] },
  },
  {
    path: 'species/:sourceTable/:speciesId/edit',
    component: EditorWorkspacePage,
    canActivate: [adminPermissionGuard],
    data: { mode: 'edit', permissions: ['species.update'] },
  },
  { path: 'requests', component: EditorWorkspacePage, data: { mode: 'requests' } },
];

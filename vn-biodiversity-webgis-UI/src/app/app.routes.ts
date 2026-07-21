import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { MapPage } from './pages/map/map.page';
import { SpeciesDetailPage } from './pages/species-detail/species-detail.page';
import { SpeciesListPage } from './pages/species-list/species-list.page';
import { StatisticsPage } from './pages/statistics/statistics.page';
import { TaxonomyPage } from './pages/taxonomy/taxonomy.page';
import { EndangeredSpeciesPage } from './pages/endangered-species/endangered-species.page';
import { adminAuthGuard } from './core/auth/admin-auth.guard';
import { adminRoutes } from './pages/admin/admin.routes';
import { LoginPage } from './pages/login/login.page';

export const routes: Routes = [
  {
    path: '',
    component: HomePage,
    title: 'VN Biodiversity WebGIS',
  },
  {
    path: 'search',
    redirectTo: 'species-list',
    pathMatch: 'full',
  },
  {
    path: 'species',
    redirectTo: 'species-list',
    pathMatch: 'full',
  },
  {
    path: 'species-list',
    component: SpeciesListPage,
    title: 'Danh mục loài',
  },
  {
    path: 'species/:sourceTable/:speciesId',
    component: SpeciesDetailPage,
    title: 'Chi tiết loài',
  },
  {
    path: 'taxonomy',
    component: TaxonomyPage,
    title: 'Phân loại sinh học',
  },
  {
    path: 'map',
    component: MapPage,
    title: 'Bản đồ WebGIS',
  },
  {
    path: 'statistics',
    component: StatisticsPage,
    title: 'Thống kê biodiversity',
  },
  {
    path: 'endangered-species',
    component: EndangeredSpeciesPage,
    title: 'Danh sách đỏ',
  },
  {
    path: 'login',
    component: LoginPage,
    title: 'Đăng nhập Admin',
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    children: adminRoutes,
    title: 'Admin',
  },
];

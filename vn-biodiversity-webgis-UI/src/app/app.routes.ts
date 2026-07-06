import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { MapPage } from './pages/map/map.page';
import { SpeciesDetailPage } from './pages/species-detail/species-detail.page';
import { SpeciesListPage } from './pages/species-list/species-list.page';

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
    title: 'Chi tiet loai',
  },
  {
    path: 'map',
    component: MapPage,
    title: 'Ban do WebGIS',
  },
];

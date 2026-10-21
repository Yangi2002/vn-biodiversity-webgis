export interface StatsDashboardQueryDto {
  section?: 'composition' | 'temporal' | 'taxonomy' | 'reserves' | 'iucn';
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect' | 'fungi' | 'protista';
  yearFrom?: string;
  yearTo?: string;
  basisOfRecord?: string;
  hasImage?: 'all' | 'true' | 'false';
  search?: string;
  reserveId?: string;
}

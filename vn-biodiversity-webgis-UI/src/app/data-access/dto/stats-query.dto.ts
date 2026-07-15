export interface StatsDashboardQueryDto {
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect';
  yearFrom?: string;
  yearTo?: string;
  basisOfRecord?: string;
  hasImage?: 'all' | 'true' | 'false';
}

export interface StatsDashboardQueryDto {
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect' | 'fungi';
  yearFrom?: string;
  yearTo?: string;
  basisOfRecord?: string;
  hasImage?: 'all' | 'true' | 'false';
}

export interface StatsDashboardQueryDto {
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect' | 'fungi' | 'protista';
  yearFrom?: string;
  yearTo?: string;
  basisOfRecord?: string;
  hasImage?: 'all' | 'true' | 'false';
}

export interface OccurrenceOverviewQueryDto {
  gridSize?: number;
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect';
  yearFrom?: number;
  yearTo?: number;
}

export interface OccurrenceOverviewQueryDto {
  gridSize?: number;
  sourceGroup?: 'all' | 'animal' | 'plant' | 'insect' | 'fungi' | 'protista' | 'algae';
  yearFrom?: number;
  yearTo?: number;
}

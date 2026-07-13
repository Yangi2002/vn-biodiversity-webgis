export const API_ENDPOINTS = {
  root: '/',
  health: '/health',
  speciesSearch: '/species/search',
  taxonomySearch: '/taxonomy/search',
  occurrenceMapOverview: '/occurrences/map/overview',
  occurrenceCellDetail: '/occurrences/map/cell-detail',
  speciesDetail: (sourceTable: string, speciesId: string) =>
    `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
} as const;

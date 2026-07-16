export const API_ENDPOINTS = {
  root: '/',
  health: '/health',
  speciesSearch: '/species/search',
  taxonomySearch: '/taxonomy/search',
  statsDashboard: '/stats/dashboard',
  endangeredSpecies: '/conservation/endangered-species',
  occurrenceMapOverview: '/occurrences/map/overview',
  occurrenceCellDetail: '/occurrences/map/cell-detail',
  speciesOccurrences: (sourceTable: string, speciesId: string) =>
    `/occurrences/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
  speciesDetail: (sourceTable: string, speciesId: string) =>
    `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
} as const;

export const API_ENDPOINTS = {
  root: '/',
  health: '/health',
  authLogin: '/auth/login',
  authMe: '/auth/me',
  speciesSearch: '/species/search',
  taxonomySearch: '/taxonomy/search',
  taxonomyTree: '/taxonomy/tree',
  taxonomyTreeChildren: (taxonId: string) => `/taxonomy/tree/${encodeURIComponent(taxonId)}/children`,
  statsSummary: '/stats/summary',
  statsDashboard: '/stats/dashboard',
  endangeredSpecies: '/conservation/endangered-species',
  nationalParks: '/national-parks',
  nationalParksSummary: '/national-parks/summary',
  nationalParksMapLayer: '/national-parks/map-layer',
  nationalParkDetail: (parkId: string) => `/national-parks/${encodeURIComponent(parkId)}`,
  occurrenceMapOverview: '/occurrences/map/overview',
  occurrenceCellDetail: '/occurrences/map/cell-detail',
  speciesOccurrences: (sourceTable: string, speciesId: string) =>
    `/occurrences/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
  speciesDetail: (sourceTable: string, speciesId: string) =>
    `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
} as const;

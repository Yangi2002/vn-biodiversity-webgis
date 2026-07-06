export const API_ENDPOINTS = {
  root: '/',
  health: '/health',
  speciesSearch: '/species/search',
  speciesDetail: (sourceTable: string, speciesId: string) =>
    `/species/${encodeURIComponent(sourceTable)}/${encodeURIComponent(speciesId)}`,
} as const;

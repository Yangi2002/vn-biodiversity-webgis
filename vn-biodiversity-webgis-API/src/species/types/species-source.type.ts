export const SPECIES_SOURCE_TABLES = [
  'animal_db_vn',
  'plant_db_vn',
  'insect_db_vn',
] as const;

export type SpeciesSourceTable = (typeof SPECIES_SOURCE_TABLES)[number];

export function isSpeciesSourceTable(value: string): value is SpeciesSourceTable {
  return SPECIES_SOURCE_TABLES.includes(value as SpeciesSourceTable);
}

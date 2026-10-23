import {
  SPECIES_SOURCE_TABLES,
  type SpeciesSourceTable,
} from '../species/types/species-source.type';

export const EDITOR_SOURCE_TABLES = SPECIES_SOURCE_TABLES;

export type EditorSourceTable = SpeciesSourceTable;
export type EditorImportSource = EditorSourceTable | 'all';
export type EditorChangeAction = 'create' | 'update' | 'import';
export type EditorValidationMode = 'create' | 'update' | 'import';
export type EditorValidationStatus = 'new' | 'changed' | 'duplicate' | 'conflict' | 'invalid';

export interface EditorSpeciesDraft {
  sourceTable?: string;
  speciesId?: string;
  vietnameseName?: string;
  scientificName?: string;
  className?: string;
  order?: string;
  family?: string;
  identification?: string;
  ecology?: string;
  distribution?: string;
  conservationStatus?: string;
  protectionMeasures?: string;
  description?: string;
  references?: string;
}

export interface EditorImportRequest {
  sourceTable?: string;
  rows?: EditorSpeciesDraft[];
  fileName?: string;
}

export interface EditorChangeRequest {
  request_id: string;
  source_table: EditorSourceTable;
  species_id: string;
  action_type: EditorChangeAction;
  payload: EditorSpeciesDraft;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: Date;
  review_note: string | null;
}

export interface EditorImportResult {
  accepted: number;
  skipped: number;
  requests: EditorChangeRequest[];
}

export interface EditorValidationRequest {
  sourceTable?: string;
  mode?: string;
  rows?: EditorSpeciesDraft[];
}

export interface EditorFieldChange {
  field: keyof EditorSpeciesDraft;
  label: string;
  previousValue: string;
  nextValue: string;
}

export interface EditorValidationRow {
  rowNumber: number;
  sourceTable: string;
  speciesId: string;
  scientificName: string;
  status: EditorValidationStatus;
  recommendedAction: 'create' | 'update' | 'skip' | 'fix';
  canSubmit: boolean;
  existingSpeciesId: string | null;
  missingFields: string[];
  errors: string[];
  changes: EditorFieldChange[];
}

export interface EditorValidationResult {
  total: number;
  submittable: number;
  newCount: number;
  changedCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: EditorValidationRow[];
}

export interface EditorExistingSpecies {
  speciesId: string;
  vietnameseName: string | null;
  scientificName: string | null;
  className: string | null;
  order: string | null;
  family: string | null;
  identification: string | null;
  ecology: string | null;
  distribution: string | null;
  conservationStatus: string | null;
  protectionMeasures: string | null;
  description: string | null;
  references: string | null;
}

export function isEditorSourceTable(value: string): value is EditorSourceTable {
  return EDITOR_SOURCE_TABLES.includes(value as EditorSourceTable);
}

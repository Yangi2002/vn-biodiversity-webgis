export type EditorSourceTable =
  | 'animal_db_vn'
  | 'plant_db_vn'
  | 'insect_db_vn'
  | 'fungi_db_vn'
  | 'algae_db_vn'
  | 'protista_db_vn';
export type EditorImportSource = EditorSourceTable | 'all';
export type EditorRequestStatus = 'pending' | 'approved' | 'rejected';
export type EditorRequestAction = 'create' | 'update' | 'import';
export type EditorValidationMode = 'create' | 'update' | 'import';
export type EditorValidationStatus = 'new' | 'changed' | 'duplicate' | 'conflict' | 'invalid';

export interface EditorSpeciesDraft {
  sourceTable: EditorSourceTable | '';
  speciesId: string;
  vietnameseName: string;
  scientificName: string;
  className: string;
  order: string;
  family: string;
  identification: string;
  ecology: string;
  distribution: string;
  conservationStatus: string;
  protectionMeasures: string;
  description: string;
  references: string;
}

export interface EditorChangeRequest {
  request_id: string;
  source_table: EditorSourceTable;
  species_id: string;
  action_type: EditorRequestAction;
  payload: EditorSpeciesDraft;
  status: EditorRequestStatus;
  submitted_at: string;
  review_note: string | null;
}

export interface EditorImportResponse {
  accepted: number;
  skipped: number;
  requests: EditorChangeRequest[];
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

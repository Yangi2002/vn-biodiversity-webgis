import type { ChangeRequestAction } from './change-request-action.type';
import type { ChangeRequestStatus } from './change-request-status.type';

export type GovernanceSourceTable = 'animal_db_vn' | 'plant_db_vn' | 'insect_db_vn';

export interface SpeciesChangeRequest {
  requestId: string;
  sourceTable: GovernanceSourceTable;
  speciesId: number;
  actionType: ChangeRequestAction;
  status: ChangeRequestStatus;
}

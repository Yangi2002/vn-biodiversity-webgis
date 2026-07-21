import type { GovernanceRole } from './governance-role.model';

export type ChangeRequestAction = 'create' | 'update' | 'delete';
export type ChangeRequestStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived';
export type GovernanceSourceTable = 'animal_db_vn' | 'plant_db_vn' | 'insect_db_vn';

export interface ChangeRequest {
  requestId: string;
  sourceTable: GovernanceSourceTable;
  speciesId: number;
  actionType: ChangeRequestAction;
  status: ChangeRequestStatus;
  submittedByRole?: GovernanceRole;
}

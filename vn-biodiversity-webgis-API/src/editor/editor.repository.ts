import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  EditorChangeAction,
  EditorChangeRequest,
  EditorExistingSpecies,
  EditorSourceTable,
  EditorSpeciesDraft,
} from './editor.types';

@Injectable()
export class EditorRepository {
  constructor(private readonly prisma: PrismaService) {}

  listOwnRequests(userId: string): Promise<EditorChangeRequest[]> {
    return this.prisma.$queryRaw<EditorChangeRequest[]>`
      SELECT request_id, source_table, species_id, action_type, payload,
             status, submitted_at, review_note
      FROM species_change_requests
      WHERE submitted_by = ${userId}::uuid
      ORDER BY submitted_at DESC
      LIMIT 200
    `;
  }

  findSpeciesCandidates(
    sourceTable: EditorSourceTable,
    speciesIds: string[],
    scientificNames: string[],
  ): Promise<EditorExistingSpecies[]> {
    if (!speciesIds.length && !scientificNames.length) {
      return Promise.resolve([]);
    }

    return this.prisma.$queryRawUnsafe<EditorExistingSpecies[]>(
      `
        SELECT
          species_id AS "speciesId",
          ten_viet_nam AS "vietnameseName",
          ten_latin AS "scientificName",
          lop_nhom AS "className",
          bo AS "order",
          ho AS "family",
          dac_diem_nhan_dang AS "identification",
          sinh_hoc_sinh_thai AS "ecology",
          phan_bo AS "distribution",
          tinh_trang AS "conservationStatus",
          bien_phap_bao_ve AS "protectionMeasures",
          COALESCE(mo_ta, mo_ta_loai) AS "description",
          tai_lieu_dan AS "references"
        FROM "${sourceTable}"
        WHERE lower(trim(species_id)) = ANY($1::text[])
           OR lower(regexp_replace(trim(COALESCE(ten_latin, '')), '\\s+', ' ', 'g')) = ANY($2::text[])
      `,
      speciesIds,
      scientificNames,
    );
  }

  async createRequest(
    userId: string,
    sourceTable: EditorSourceTable,
    speciesId: string,
    action: EditorChangeAction,
    payload: EditorSpeciesDraft,
  ): Promise<EditorChangeRequest> {
    const rows = await this.prisma.$queryRaw<EditorChangeRequest[]>`
      INSERT INTO species_change_requests (
        submitted_by, source_table, species_id, action_type, payload
      ) VALUES (
        ${userId}::uuid,
        ${sourceTable},
        ${speciesId},
        ${action},
        ${JSON.stringify(payload)}::jsonb
      )
      RETURNING request_id, source_table, species_id, action_type, payload,
                status, submitted_at, review_note
    `;

    return rows[0];
  }

  createImportRequests(
    userId: string,
    entries: { draft: EditorSpeciesDraft & { sourceTable: EditorSourceTable }; action: EditorChangeAction }[],
  ): Promise<EditorChangeRequest[]> {
    return this.prisma.$queryRaw<EditorChangeRequest[]>`
      INSERT INTO species_change_requests (
        submitted_by, source_table, species_id, action_type, payload
      )
      SELECT
        ${userId}::uuid,
        item ->> 'sourceTable',
        item ->> 'speciesId',
        item ->> 'actionType',
        item - 'actionType'
      FROM jsonb_array_elements(${JSON.stringify(
        entries.map(({ draft, action }) => ({ ...draft, actionType: action })),
      )}::jsonb) AS item
      RETURNING request_id, source_table, species_id, action_type, payload,
                status, submitted_at, review_note
    `;
  }
}

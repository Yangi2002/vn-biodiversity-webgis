import { BadRequestException, Injectable } from '@nestjs/common';
import { EditorRepository } from './editor.repository';
import {
  EDITOR_SOURCE_TABLES,
  type EditorChangeRequest,
  type EditorExistingSpecies,
  type EditorFieldChange,
  type EditorImportRequest,
  type EditorImportResult,
  type EditorSourceTable,
  type EditorSpeciesDraft,
  type EditorValidationMode,
  type EditorValidationRequest,
  type EditorValidationResult,
  type EditorValidationRow,
  isEditorSourceTable,
} from './editor.types';

type DraftField = Exclude<keyof EditorSpeciesDraft, 'sourceTable'>;

const FIELD_DEFINITIONS: readonly { field: DraftField; label: string }[] = [
  { field: 'speciesId', label: 'Mã loài' },
  { field: 'vietnameseName', label: 'Tên Việt Nam' },
  { field: 'scientificName', label: 'Tên khoa học' },
  { field: 'className', label: 'Lớp / nhóm' },
  { field: 'order', label: 'Bộ' },
  { field: 'family', label: 'Họ' },
  { field: 'identification', label: 'Đặc điểm nhận dạng' },
  { field: 'ecology', label: 'Sinh học và sinh thái' },
  { field: 'distribution', label: 'Phân bố' },
  { field: 'conservationStatus', label: 'Tình trạng bảo tồn' },
  { field: 'protectionMeasures', label: 'Biện pháp bảo vệ' },
  { field: 'description', label: 'Mô tả' },
  { field: 'references', label: 'Tài liệu dẫn / nguồn' },
];

@Injectable()
export class EditorService {
  constructor(private readonly repository: EditorRepository) {}

  listOwnRequests(userId: string): Promise<EditorChangeRequest[]> {
    return this.repository.listOwnRequests(userId);
  }

  async validateSpecies(input: EditorValidationRequest): Promise<EditorValidationResult> {
    const mode = this.validationMode(input.mode);
    const selectedSource = (input.sourceTable ?? 'all').trim();
    const rows = input.rows;

    if (selectedSource !== 'all' && !isEditorSourceTable(selectedSource)) {
      throw new BadRequestException('Nhóm dữ liệu kiểm duyệt không hợp lệ.');
    }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
      throw new BadRequestException('Mỗi lần kiểm duyệt phải có từ 1 đến 500 dòng.');
    }

    const drafts = rows.map((row) =>
      this.normalize({
        ...row,
        sourceTable: selectedSource === 'all' ? row.sourceTable : selectedSource,
      }),
    );
    const candidates = await this.loadCandidates(drafts);
    const seenIds = new Map<string, number>();
    const seenNames = new Map<string, number>();
    const validationRows = drafts.map((draft, index) =>
      this.validateRow(draft, index, mode, candidates, seenIds, seenNames),
    );

    return {
      total: validationRows.length,
      submittable: validationRows.filter((row) => row.canSubmit).length,
      newCount: validationRows.filter((row) => row.status === 'new').length,
      changedCount: validationRows.filter((row) => row.status === 'changed').length,
      duplicateCount: validationRows.filter((row) => row.status === 'duplicate').length,
      invalidCount: validationRows.filter((row) => row.status === 'invalid' || row.status === 'conflict').length,
      rows: validationRows,
    };
  }

  async createSpecies(userId: string, body: EditorSpeciesDraft): Promise<EditorChangeRequest> {
    const validation = await this.validateSpecies({ mode: 'create', rows: [body] });
    this.assertSingleRowCanSubmit(validation.rows[0]);
    const draft = this.validateDraft(body);
    return this.repository.createRequest(userId, draft.sourceTable, draft.speciesId, 'create', draft);
  }

  async updateSpecies(
    userId: string,
    sourceTable: string,
    speciesId: string,
    body: EditorSpeciesDraft,
  ): Promise<EditorChangeRequest> {
    const candidate = { ...body, sourceTable, speciesId };
    const validation = await this.validateSpecies({ mode: 'update', rows: [candidate] });
    this.assertSingleRowCanSubmit(validation.rows[0]);
    const draft = this.validateDraft(candidate);
    return this.repository.createRequest(userId, draft.sourceTable, draft.speciesId, 'update', draft);
  }

  async importSpecies(userId: string, body: EditorImportRequest): Promise<EditorImportResult> {
    const sourceTable = body.sourceTable?.trim() || 'all';
    const validation = await this.validateSpecies({ sourceTable, mode: 'import', rows: body.rows });
    const blocked = validation.rows.find((row) => row.status === 'invalid' || row.status === 'conflict');

    if (blocked) {
      throw new BadRequestException(
        `Dòng ${blocked.rowNumber}: ${blocked.errors.join(' ') || 'dữ liệu chưa hợp lệ.'}`,
      );
    }

    const entries = validation.rows
      .filter((row) => row.canSubmit)
      .map((row) => {
        const draft = this.validateDraft({
          ...body.rows![row.rowNumber - 1],
          sourceTable: row.sourceTable,
        });
        return {
          draft: { ...draft, references: draft.references || body.fileName?.trim() },
          action: row.recommendedAction === 'update' ? 'update' as const : 'import' as const,
        };
      });

    if (!entries.length) {
      throw new BadRequestException('Không có dòng mới hoặc thay đổi để gửi kiểm duyệt.');
    }

    const requests = await this.repository.createImportRequests(userId, entries);
    return { accepted: requests.length, skipped: validation.total - requests.length, requests };
  }

  private async loadCandidates(drafts: EditorSpeciesDraft[]) {
    const result = new Map<string, EditorExistingSpecies>();

    await Promise.all(EDITOR_SOURCE_TABLES.map(async (sourceTable) => {
      const sourceDrafts = drafts.filter((draft) =>
        draft.sourceTable === sourceTable || !isEditorSourceTable(this.text(draft.sourceTable)),
      );
      if (!sourceDrafts.length) return;

      const speciesIds = Array.from(new Set(
        sourceDrafts.map((draft) => this.text(draft.speciesId).toLowerCase()).filter(Boolean),
      ));
      const scientificNames = Array.from(new Set(
        sourceDrafts.map((draft) => this.normalizeScientificName(draft.scientificName)).filter(Boolean),
      ));
      const rows = await this.repository.findSpeciesCandidates(sourceTable, speciesIds, scientificNames);

      for (const row of rows) {
        result.set(this.idKey(sourceTable, row.speciesId), row);
        const name = this.normalizeScientificName(row.scientificName);
        if (name) result.set(this.nameKey(sourceTable, name), row);
      }
    }));

    return result;
  }

  private validateRow(
    draft: EditorSpeciesDraft,
    index: number,
    mode: EditorValidationMode,
    candidates: Map<string, EditorExistingSpecies>,
    seenIds: Map<string, number>,
    seenNames: Map<string, number>,
  ): EditorValidationRow {
    let sourceTable = this.text(draft.sourceTable);
    const speciesId = this.text(draft.speciesId);
    const scientificName = this.text(draft.scientificName);
    const errors: string[] = [];
    const missingFields = FIELD_DEFINITIONS
      .filter(({ field }) => !this.text(draft[field]))
      .map(({ label }) => label);

    if (!speciesId) errors.push('Thiếu mã loài.');
    if (speciesId.length > 120) errors.push('Mã loài vượt quá 120 ký tự.');
    if (!scientificName) errors.push('Thiếu tên khoa học.');
    if (scientificName.length > 500) errors.push('Tên khoa học vượt quá 500 ký tự.');
    for (const { field, label } of FIELD_DEFINITIONS) {
      if (this.text(draft[field]).length > 20_000) errors.push(`${label} vượt quá 20.000 ký tự.`);
    }

    const normalizedName = this.normalizeScientificName(scientificName);
    if (!isEditorSourceTable(sourceTable)) {
      const matchingSources = EDITOR_SOURCE_TABLES.filter((candidateSource) =>
        (speciesId && candidates.has(this.idKey(candidateSource, speciesId))) ||
        (normalizedName && candidates.has(this.nameKey(candidateSource, normalizedName))),
      );
      if (matchingSources.length === 1) {
        sourceTable = matchingSources[0];
      } else if (matchingSources.length > 1) {
        errors.push('Loài khớp nhiều nhóm dữ liệu; cần chỉ rõ nhóm.');
      } else {
        errors.push('Thiếu hoặc sai nhóm dữ liệu.');
      }
    }

    const idKey = isEditorSourceTable(sourceTable) && speciesId ? this.idKey(sourceTable, speciesId) : '';
    const nameKey = isEditorSourceTable(sourceTable) && normalizedName
      ? this.nameKey(sourceTable, normalizedName)
      : '';
    const duplicateIdRow = idKey ? seenIds.get(idKey) : undefined;
    const duplicateNameRow = nameKey ? seenNames.get(nameKey) : undefined;

    if (duplicateIdRow !== undefined) errors.push(`Trùng mã loài với dòng ${duplicateIdRow}.`);
    if (duplicateNameRow !== undefined) errors.push(`Trùng tên khoa học với dòng ${duplicateNameRow}.`);
    if (idKey && duplicateIdRow === undefined) seenIds.set(idKey, index + 1);
    if (nameKey && duplicateNameRow === undefined) seenNames.set(nameKey, index + 1);

    const existingById = idKey ? candidates.get(idKey) : undefined;
    const existingByName = nameKey ? candidates.get(nameKey) : undefined;
    const conflictingName = existingByName && existingByName.speciesId !== speciesId
      ? existingByName
      : undefined;
    const compareTarget = existingById ?? existingByName;
    const changes = compareTarget ? this.changedFields(draft, compareTarget, mode === 'import') : [];

    if (conflictingName) errors.push(`Tên khoa học đã thuộc mã loài ${conflictingName.speciesId}.`);
    if (mode === 'update' && !existingById) {
      errors.push('Không tìm thấy mã loài cần cập nhật trong nhóm dữ liệu này.');
    }

    let status: EditorValidationRow['status'] = 'new';
    let recommendedAction: EditorValidationRow['recommendedAction'] = 'create';
    let canSubmit = true;

    if (errors.length) {
      status = conflictingName || duplicateIdRow !== undefined || duplicateNameRow !== undefined
        ? 'conflict'
        : 'invalid';
      recommendedAction = 'fix';
      canSubmit = false;
    } else if (mode === 'create' && compareTarget) {
      status = changes.length ? 'conflict' : 'duplicate';
      recommendedAction = changes.length ? 'fix' : 'skip';
      canSubmit = false;
      if (changes.length) errors.push('Mã loài đã tồn tại; hãy dùng chức năng chỉnh sửa.');
    } else if (compareTarget) {
      status = changes.length ? 'changed' : 'duplicate';
      recommendedAction = changes.length ? 'update' : 'skip';
      canSubmit = changes.length > 0;
    }

    return {
      rowNumber: index + 1,
      sourceTable,
      speciesId,
      scientificName,
      status,
      recommendedAction,
      canSubmit,
      existingSpeciesId: compareTarget?.speciesId ?? null,
      missingFields,
      errors,
      changes,
    };
  }

  private changedFields(
    draft: EditorSpeciesDraft,
    existing: EditorExistingSpecies,
    ignoreBlankValues: boolean,
  ): EditorFieldChange[] {
    const changes: EditorFieldChange[] = [];

    for (const { field, label } of FIELD_DEFINITIONS) {
      if (field === 'speciesId') continue;
      const nextValue = this.text(draft[field]);
      const previousValue = this.text(existing[field]);
      if (ignoreBlankValues && !nextValue) continue;
      if (this.normalizeComparable(previousValue) !== this.normalizeComparable(nextValue)) {
        changes.push({ field, label, previousValue, nextValue });
      }
    }

    return changes;
  }

  private assertSingleRowCanSubmit(row: EditorValidationRow | undefined) {
    if (!row?.canSubmit) {
      throw new BadRequestException(
        row?.errors.join(' ') || (row?.status === 'duplicate'
          ? 'Dữ liệu không có thay đổi để gửi.'
          : 'Dữ liệu chưa hợp lệ.'),
      );
    }
  }

  private validationMode(value: string | undefined): EditorValidationMode {
    if (value === 'create' || value === 'update' || value === 'import') return value;
    throw new BadRequestException('Chế độ kiểm duyệt không hợp lệ.');
  }

  private validateDraft(body: EditorSpeciesDraft): EditorSpeciesDraft & {
    sourceTable: EditorSourceTable;
    speciesId: string;
  } {
    const normalized = this.normalize(body);
    const sourceTable = this.text(normalized.sourceTable);
    const speciesId = this.text(normalized.speciesId);
    const scientificName = this.text(normalized.scientificName);

    if (!isEditorSourceTable(sourceTable)) {
      throw new BadRequestException('Nhóm dữ liệu loài không hợp lệ.');
    }
    if (!speciesId || speciesId.length > 120) {
      throw new BadRequestException('Mã loài là bắt buộc và không vượt quá 120 ký tự.');
    }
    if (!scientificName) throw new BadRequestException('Tên khoa học là bắt buộc.');

    return { ...normalized, sourceTable, speciesId, scientificName };
  }

  private normalize(body: EditorSpeciesDraft): EditorSpeciesDraft {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    ) as EditorSpeciesDraft;
  }

  private text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeComparable(value: unknown): string {
    return this.text(value).replace(/\s+/g, ' ').toLocaleLowerCase('vi');
  }

  private normalizeScientificName(value: unknown): string {
    return this.text(value).replace(/\s+/g, ' ').toLowerCase();
  }

  private idKey(sourceTable: EditorSourceTable, speciesId: string): string {
    return `${sourceTable}:id:${speciesId.toLowerCase()}`;
  }

  private nameKey(sourceTable: EditorSourceTable, scientificName: string): string {
    return `${sourceTable}:name:${scientificName}`;
  }
}

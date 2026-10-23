import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import * as XLSX from 'xlsx';

import type {
  EditorChangeRequest,
  EditorImportSource,
  EditorSourceTable,
  EditorSpeciesDraft,
  EditorValidationResult,
  EditorValidationRow,
} from '../../../data-access/models/editor.model';
import type { SpeciesDetailResponse, SpeciesSearchItem } from '../../../data-access/models/species.model';
import { EditorService } from '../../../data-access/services/editor.service';
import { SpeciesService } from '../../../data-access/services/species.service';
import { AdminAuthService } from '../../../data-access/services/auth/admin-auth.service';
import {
  ManagementSidebarComponent,
  type ManagementTab,
} from '../../../shared/components/management-sidebar/management-sidebar.component';

type EditorMode = 'overview' | 'import' | 'create' | 'edit' | 'requests';

const SOURCE_OPTIONS: { value: EditorSourceTable; label: string }[] = [
  { value: 'animal_db_vn', label: 'Động vật' },
  { value: 'plant_db_vn', label: 'Thực vật' },
  { value: 'insect_db_vn', label: 'Côn trùng' },
  { value: 'fungi_db_vn', label: 'Nấm' },
  { value: 'algae_db_vn', label: 'Tảo' },
  { value: 'protista_db_vn', label: 'Vi sinh / nguyên sinh' },
];

const IMPORT_SOURCE_OPTIONS: { value: EditorImportSource; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  ...SOURCE_OPTIONS,
];

@Component({
  selector: 'app-editor-workspace-page',
  imports: [DatePipe, DecimalPipe, ManagementSidebarComponent, FormsModule, NgTemplateOutlet, RouterLink],
  templateUrl: './editor-workspace.page.html',
  styleUrl: './editor-workspace.page.css',
})
export class EditorWorkspacePage {
  private readonly route = inject(ActivatedRoute);
  private readonly editor = inject(EditorService);
  private readonly species = inject(SpeciesService);
  private readonly auth = inject(AdminAuthService);

  readonly mode = this.route.snapshot.data['mode'] as EditorMode;
  readonly sourceOptions = SOURCE_OPTIONS;
  readonly importSourceOptions = IMPORT_SOURCE_OPTIONS;
  readonly requests = signal<EditorChangeRequest[]>([]);
  readonly searchResults = signal<SpeciesSearchItem[]>([]);
  readonly importRows = signal<EditorSpeciesDraft[]>([]);
  readonly importErrors = signal<string[]>([]);
  readonly importValidation = signal<EditorValidationResult | null>(null);
  readonly draftValidation = signal<EditorValidationRow | null>(null);
  readonly isValidating = signal(false);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  readonly pendingCount = computed(() => this.requests().filter((item) => item.status === 'pending').length);
  readonly approvedCount = computed(() => this.requests().filter((item) => item.status === 'approved').length);
  readonly rejectedCount = computed(() => this.requests().filter((item) => item.status === 'rejected').length);
  readonly canCreate = this.auth.hasPermission(['species.create']);
  readonly canUpdate = this.auth.hasPermission(['species.update']);

  searchTerm = '';
  importSource: EditorImportSource = 'all';
  selectedFileName = '';
  draft = this.emptyDraft();

  constructor() {
    this.loadRequests();
    if (this.mode === 'edit') this.loadSpeciesForEdit();
  }

  get activeTab(): ManagementTab {
    return this.mode === 'edit' ? 'create' : this.mode;
  }

  searchSpecies() {
    this.isLoading.set(true);
    this.species.search({ q: this.searchTerm, limit: 12 }).pipe(
      finalize(() => this.isLoading.set(false)),
    ).subscribe({
      next: (response) => this.searchResults.set(
        response.items.filter((item) =>
          SOURCE_OPTIONS.some((source) => source.value === item.sourceTable),
        ),
      ),
      error: () => this.showError('Chưa thể tìm dữ liệu loài.'),
    });
  }

  async selectFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.message.set('');
    this.selectedFileName = file.name;
    this.importValidation.set(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const rows = rawRows.slice(0, 500).map((row) => this.mapImportRow(row));
      this.importRows.set(rows);
      this.importErrors.set([]);
      if (rawRows.length > 500) {
        this.importErrors.update((items) => [...items, 'File vượt quá 500 dòng; hãy chia thành nhiều lần import.']);
      }
      if (rows.length) this.validateImportRows(rows);
    } catch {
      this.importRows.set([]);
      this.importErrors.set(['Không đọc được file. Chỉ sử dụng định dạng .xlsx, .xls hoặc .csv hợp lệ.']);
    }
  }

  submitImport() {
    const validation = this.importValidation();
    if (!this.importRows().length || this.importErrors().length || !validation?.submittable) return;
    this.isSubmitting.set(true);
    this.editor.importSpecies(this.importSource, this.importRows(), this.selectedFileName).pipe(
      finalize(() => this.isSubmitting.set(false)),
    ).subscribe({
      next: (result) => {
        this.showSuccess(
          `Đã gửi ${result.accepted} dòng vào hàng chờ; bỏ qua ${result.skipped} dòng trùng hoặc không thay đổi.`,
        );
        this.importRows.set([]);
        this.importValidation.set(null);
        this.selectedFileName = '';
        this.loadRequests();
      },
      error: (error: HttpErrorResponse) => this.showApiError(error),
    });
  }

  previewDraft() {
    this.isValidating.set(true);
    this.draftValidation.set(null);
    this.editor.validateSpecies(
      this.mode === 'edit' ? 'update' : 'create',
      [this.draft],
      this.draft.sourceTable || 'all',
    ).pipe(finalize(() => this.isValidating.set(false))).subscribe({
      next: (result) => this.draftValidation.set(result.rows[0] ?? null),
      error: (error: HttpErrorResponse) => this.showApiError(error),
    });
  }

  submitDraft() {
    if (!this.draftValidation()?.canSubmit) {
      this.showError('Hãy kiểm tra dữ liệu và xử lý lỗi trước khi gửi.');
      return;
    }
    this.isSubmitting.set(true);
    const request = this.mode === 'edit'
      ? this.editor.updateSpecies(this.draft.sourceTable, this.draft.speciesId, this.draft)
      : this.editor.createSpecies(this.draft);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        this.showSuccess('Đề xuất đã được gửi và đang chờ quản trị viên duyệt.');
        if (this.mode === 'create') this.draft = this.emptyDraft();
        this.draftValidation.set(null);
        this.loadRequests();
      },
      error: (error: HttpErrorResponse) => this.showApiError(error),
    });
  }

  statusLabel(status: EditorChangeRequest['status']) {
    return { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }[status];
  }

  actionLabel(action: EditorChangeRequest['action_type']) {
    return { create: 'Thêm mới', update: 'Chỉnh sửa', import: 'Import file' }[action];
  }

  validationStatusLabel(status: EditorValidationRow['status']) {
    return {
      new: 'Dữ liệu mới',
      changed: 'Có thay đổi',
      duplicate: 'Trùng hoàn toàn',
      conflict: 'Xung đột',
      invalid: 'Có lỗi',
    }[status];
  }

  sourceLabel(sourceTable: string) {
    return SOURCE_OPTIONS.find((source) => source.value === sourceTable)?.label ?? 'Chưa xác định';
  }

  clearDraftValidation() {
    this.draftValidation.set(null);
  }

  resetImportPreview() {
    this.selectedFileName = '';
    this.importRows.set([]);
    this.importErrors.set([]);
    this.importValidation.set(null);
  }

  private loadRequests() {
    this.editor.listRequests().subscribe({
      next: (requests) => this.requests.set(requests),
      error: () => this.showError('Chưa thể tải danh sách đề xuất.'),
    });
  }

  private loadSpeciesForEdit() {
    const sourceTable = this.route.snapshot.paramMap.get('sourceTable') ?? '';
    const speciesId = this.route.snapshot.paramMap.get('speciesId') ?? '';
    this.isLoading.set(true);
    this.species.getDetail(sourceTable, speciesId).pipe(
      finalize(() => this.isLoading.set(false)),
    ).subscribe({
      next: (detail) => (this.draft = this.draftFromDetail(detail)),
      error: () => this.showError('Không tải được hồ sơ loài cần chỉnh sửa.'),
    });
  }

  private draftFromDetail(detail: SpeciesDetailResponse): EditorSpeciesDraft {
    const field = (key: string) => detail.fields.find((item) => item.key === key)?.value ?? '';
    return {
      sourceTable: detail.sourceTable as EditorSourceTable,
      speciesId: detail.speciesId,
      vietnameseName: detail.vietnameseName ?? '', scientificName: detail.scientificName ?? '',
      className: detail.className ?? '', order: detail.order ?? '', family: detail.family ?? '',
      identification: field('dac_diem_nhan_dang'), ecology: field('sinh_hoc_sinh_thai'),
      distribution: field('phan_bo'), conservationStatus: field('tinh_trang'),
      protectionMeasures: field('bien_phap_bao_ve'),
      description: field('mo_ta') || field('mo_ta_loai'), references: field('tai_lieu_dan'),
    };
  }

  private mapImportRow(row: Record<string, unknown>): EditorSpeciesDraft {
    const normalized = new Map(
      Object.entries(row).map(([key, value]) => [this.normalizeHeader(key), String(value ?? '').trim()]),
    );
    const value = (...aliases: string[]) => aliases.map((key) => normalized.get(key)).find(Boolean) ?? '';
    const rowSource = value('sourcetable', 'bangdulieu', 'nhomdulieu', 'nhom', 'group', 'kingdom');
    return {
      sourceTable: this.importSource === 'all' ? this.resolveImportSource(rowSource) : this.importSource,
      speciesId: value('speciesid', 'maloai', 'id'), vietnameseName: value('tenvietnam', 'tenviet'),
      scientificName: value('tenscientific', 'tenkhoahoc', 'tenlatin'), className: value('lopnhom', 'lop'),
      order: value('bo', 'order'), family: value('ho', 'family'),
      identification: value('dacdiemnhandang', 'nhandang'), ecology: value('sinhhocsinhthai', 'sinhthai'),
      distribution: value('phanbo'), conservationStatus: value('tinhtrang', 'baoton'),
      protectionMeasures: value('bienphapbaove'), description: value('mota', 'motaloai'),
      references: value('tailieudan', 'nguon'),
    };
  }

  private validateImportRows(rows: EditorSpeciesDraft[]) {
    this.isValidating.set(true);
    this.editor.validateSpecies('import', rows, this.importSource).pipe(
      finalize(() => this.isValidating.set(false)),
    ).subscribe({
      next: (result) => this.importValidation.set(result),
      error: (error: HttpErrorResponse) => this.showApiError(error),
    });
  }

  private resolveImportSource(value: string): EditorSourceTable | '' {
    const key = this.normalizeHeader(value);
    const aliases: Record<string, EditorSourceTable> = {
      animaldbvn: 'animal_db_vn', dongvat: 'animal_db_vn', animal: 'animal_db_vn',
      plantdbvn: 'plant_db_vn', thucvat: 'plant_db_vn', plant: 'plant_db_vn',
      insectdbvn: 'insect_db_vn', contrung: 'insect_db_vn', insect: 'insect_db_vn',
      fungidbvn: 'fungi_db_vn', nam: 'fungi_db_vn', fungi: 'fungi_db_vn', fungus: 'fungi_db_vn',
      algaedbvn: 'algae_db_vn', tao: 'algae_db_vn', algae: 'algae_db_vn',
      protistadbvn: 'protista_db_vn', visinh: 'protista_db_vn', visinhvat: 'protista_db_vn',
      nguyensinh: 'protista_db_vn', protista: 'protista_db_vn', microorganism: 'protista_db_vn',
    };
    return aliases[key] ?? '';
  }

  private normalizeHeader(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private emptyDraft(): EditorSpeciesDraft {
    return {
      sourceTable: 'animal_db_vn', speciesId: '', vietnameseName: '', scientificName: '',
      className: '', order: '', family: '', identification: '', ecology: '', distribution: '',
      conservationStatus: '', protectionMeasures: '', description: '', references: '',
    };
  }

  private showSuccess(message: string) { this.isError.set(false); this.message.set(message); }
  private showError(message: string) { this.isError.set(true); this.message.set(message); }
  private showApiError(error: HttpErrorResponse) {
    this.showError(typeof error.error?.message === 'string' ? error.error.message : 'Thao tác chưa thể hoàn tất.');
  }
}

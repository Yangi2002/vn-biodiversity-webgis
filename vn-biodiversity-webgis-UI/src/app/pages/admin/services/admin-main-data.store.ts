import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';

import type { SpeciesSearchItem } from '../../../data-access/models/species.model';
import { SpeciesService } from '../../../data-access/services/species.service';

export interface AdminMainDataTable {
  label: string;
  sourceTable: string;
  roleLabel: string;
  description: string;
}

export interface AdminMainDataSummary {
  sourceTable: string;
  total: number;
  page: number;
  totalPages: number;
  items: SpeciesSearchItem[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AdminMainDataStore {
  private readonly speciesService = inject(SpeciesService);
  private readonly pageSize = 10;
  private hasLoadedInitialData = false;

  readonly mainTables: AdminMainDataTable[] = [
    {
      label: 'Động vật',
      sourceTable: 'animal_db_vn',
      roleLabel: 'Animal Manager',
      description: 'Bảng dữ liệu động vật gốc dùng cho hồ sơ loài, taxonomy và bản đồ phân bố.',
    },
    {
      label: 'Thực vật',
      sourceTable: 'plant_db_vn',
      roleLabel: 'Plant Manager',
      description: 'Bảng dữ liệu thực vật gốc gồm cây, thực vật thủy sinh và nhóm thực vật liên quan.',
    },
    {
      label: 'Côn trùng',
      sourceTable: 'insect_db_vn',
      roleLabel: 'Insect Manager',
      description: 'Bảng dữ liệu côn trùng gốc kết nối với danh mục loài và cây phân loại.',
    },
  ];

  readonly summaries = signal<Record<string, AdminMainDataSummary>>(this.emptySummaries(false));

  ensureLoaded() {
    if (this.hasLoadedInitialData) {
      return;
    }

    this.hasLoadedInitialData = true;

    for (const table of this.mainTables) {
      this.loadTable(table, 1);
    }
  }

  reload() {
    for (const table of this.mainTables) {
      this.loadTable(table, 1, true);
    }
  }

  loadPage(table: AdminMainDataTable, page: number) {
    const summary = this.summaries()[table.sourceTable];

    if (summary.isLoading || page < 1 || page > summary.totalPages) {
      return;
    }

    this.loadTable(table, page);
  }

  private loadTable(table: AdminMainDataTable, page: number, clearBeforeLoad = false) {
    if (clearBeforeLoad) {
      this.patchSummary(table.sourceTable, {
        page,
        total: 0,
        totalPages: 1,
        items: [],
        error: null,
      });
    }

    this.patchSummary(table.sourceTable, { isLoading: true, error: null });

    this.speciesService
      .search({
        sourceTable: table.sourceTable,
        page,
        limit: this.pageSize,
      })
      .pipe(
        map(
          (response): AdminMainDataSummary => ({
            sourceTable: table.sourceTable,
            total: response.total,
            page: response.page,
            totalPages: response.totalPages,
            items: response.items,
            isLoading: false,
            error: null,
          }),
        ),
        catchError(() =>
          of({
            sourceTable: table.sourceTable,
            total: 0,
            page,
            totalPages: 1,
            items: [],
            isLoading: false,
            error: 'Chưa tải được dữ liệu bảng này.',
          }),
        ),
      )
      .subscribe((summary) => {
        this.patchSummary(table.sourceTable, summary);
      });
  }

  private patchSummary(sourceTable: string, patch: Partial<AdminMainDataSummary>) {
    this.summaries.update((current) => ({
      ...current,
      [sourceTable]: {
        ...current[sourceTable],
        ...patch,
      },
    }));
  }

  private emptySummaries(isLoading: boolean): Record<string, AdminMainDataSummary> {
    return Object.fromEntries(
      this.mainTables.map((table) => [
        table.sourceTable,
        {
          sourceTable: table.sourceTable,
          total: 0,
          page: 1,
          totalPages: 1,
          items: [],
          isLoading,
          error: null,
        },
      ]),
    );
  }
}

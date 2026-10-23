import { Injectable, inject } from '@angular/core';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { HttpApiService } from '../../core/api/http-api.service';
import type {
  EditorChangeRequest,
  EditorImportSource,
  EditorImportResponse,
  EditorSpeciesDraft,
  EditorValidationMode,
  EditorValidationResult,
} from '../models/editor.model';

@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly api = inject(HttpApiService);

  listRequests() {
    return this.api.get<EditorChangeRequest[]>(API_ENDPOINTS.editorRequests);
  }

  validateSpecies(
    mode: EditorValidationMode,
    rows: EditorSpeciesDraft[],
    sourceTable: EditorImportSource = 'all',
  ) {
    return this.api.post<EditorValidationResult>(API_ENDPOINTS.editorValidate, {
      mode,
      rows,
      sourceTable,
    });
  }

  createSpecies(draft: EditorSpeciesDraft) {
    return this.api.post<EditorChangeRequest>(API_ENDPOINTS.editorSpecies, draft);
  }

  updateSpecies(sourceTable: string, speciesId: string, draft: EditorSpeciesDraft) {
    return this.api.put<EditorChangeRequest>(
      API_ENDPOINTS.editorSpeciesItem(sourceTable, speciesId),
      draft,
    );
  }

  importSpecies(sourceTable: EditorImportSource, rows: EditorSpeciesDraft[], fileName: string) {
    return this.api.post<EditorImportResponse>(API_ENDPOINTS.editorImport, {
      sourceTable,
      rows,
      fileName,
    });
  }
}

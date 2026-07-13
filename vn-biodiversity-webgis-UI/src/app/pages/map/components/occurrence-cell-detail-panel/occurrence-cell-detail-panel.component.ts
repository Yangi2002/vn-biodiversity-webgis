import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  OccurrenceCellDetail,
  OccurrenceCellSpecies,
  OccurrenceCellTaxonomyGroup,
  OccurrenceMapCell,
} from '../../../../data-access/models/occurrence.model';

@Component({
  selector: 'app-occurrence-cell-detail-panel',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './occurrence-cell-detail-panel.component.html',
  styleUrl: './occurrence-cell-detail-panel.component.css',
})
export class OccurrenceCellDetailPanelComponent {
  @Input() selectedCell: OccurrenceMapCell | null = null;
  @Input() selectedRegionName = '';
  @Input() detail: OccurrenceCellDetail | null = null;
  @Input() isLoading = false;
  @Input() errorMessage = '';

  speciesDisplayName(species: OccurrenceCellSpecies): string {
    return species.vietnameseName || species.scientificName || species.speciesId;
  }

  taxonomyDisplayName(group: OccurrenceCellTaxonomyGroup): string {
    if (group.vietnameseName && group.vietnameseName !== group.canonicalName) {
      return `${group.vietnameseName} (${group.canonicalName})`;
    }

    return group.canonicalName;
  }

  taxonomyRankLabel(rank: string): string {
    const rankMap: Record<string, string> = {
      kingdom: 'Gi\u1edbi',
      phylum: 'Ng\u00e0nh',
      class: 'L\u1edbp',
      order: 'B\u1ed9',
      family: 'H\u1ecd',
      genus: 'Chi',
      species: 'Lo\u00e0i',
    };

    return rankMap[rank] ?? rank;
  }
}


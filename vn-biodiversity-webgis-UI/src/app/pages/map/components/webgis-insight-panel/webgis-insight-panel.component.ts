import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { OccurrenceMapCell, OccurrenceMapSummary } from '../../../../data-access/models/occurrence.model';

@Component({
  selector: 'app-webgis-insight-panel',
  imports: [DecimalPipe],
  templateUrl: './webgis-insight-panel.component.html',
  styleUrl: './webgis-insight-panel.component.css',
})
export class WebgisInsightPanelComponent {
  @Input({ required: true }) summary!: OccurrenceMapSummary;
  @Input() selectedCell: OccurrenceMapCell | null = null;
  @Input() selectedRegionName = '';
  @Input() isExpanded = true;

  @Output() expandedToggle = new EventEmitter<void>();
  @Output() selectionReset = new EventEmitter<void>();
}


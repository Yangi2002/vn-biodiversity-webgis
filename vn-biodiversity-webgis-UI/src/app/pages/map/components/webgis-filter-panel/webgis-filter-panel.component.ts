import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { OccurrenceOverviewQueryDto } from '../../../../data-access/dto/occurrence-query.dto';

type SourceGroupFilter = NonNullable<OccurrenceOverviewQueryDto['sourceGroup']>;

@Component({
  selector: 'app-webgis-filter-panel',
  templateUrl: './webgis-filter-panel.component.html',
  styleUrl: './webgis-filter-panel.component.css',
})
export class WebgisFilterPanelComponent {
  @Input({ required: true }) sourceGroup!: SourceGroupFilter;
  @Input({ required: true }) yearFrom = '';
  @Input({ required: true }) yearTo = '';
  @Input({ required: true }) gridSize = 0.5;

  @Output() sourceGroupChange = new EventEmitter<string>();
  @Output() yearFromChange = new EventEmitter<string>();
  @Output() yearToChange = new EventEmitter<string>();
  @Output() gridSizeChange = new EventEmitter<string>();
  @Output() filtersApply = new EventEmitter<void>();
  @Output() filtersClear = new EventEmitter<void>();
}


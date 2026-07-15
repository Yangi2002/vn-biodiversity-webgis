import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface DashboardMetricItem {
  label: string;
  value: string | number;
  helper?: string;
  accent?: 'default' | 'animal' | 'plant' | 'insect' | 'warning';
}

@Component({
  selector: 'app-dashboard-metric-strip',
  imports: [DecimalPipe],
  templateUrl: './dashboard-metric-strip.component.html',
  styleUrl: './dashboard-metric-strip.component.css',
})
export class DashboardMetricStripComponent {
  @Input({ required: true }) items: DashboardMetricItem[] = [];
  @Input() variant: 'dark' | 'light' = 'dark';

  isNumber(value: string | number): value is number {
    return typeof value === 'number';
  }
}

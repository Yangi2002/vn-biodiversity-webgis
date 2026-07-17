import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  StatsDashboard,
  StatsGroupMetric,
  StatsRegionGroupMetric,
  StatsRegionMetric,
  StatsRegionYearMetric,
  StatsSpeciesRanking,
  StatsSpeciesShareMetric,
  StatsYearMetric,
} from '../../data-access/models/stats.model';
import type { StatsDashboardQueryDto } from '../../data-access/dto/stats-query.dto';
import { StatsService } from '../../data-access/services/stats.service';
import { CredentialsFooterComponent } from '../../shared/components/credentials-footer/credentials-footer.component';
import {
  DashboardMetricItem,
  DashboardMetricStripComponent,
} from '../../shared/components/dashboard-metric-strip/dashboard-metric-strip.component';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import {
  ChartMetricItem,
  donutMetricBackground as buildDonutMetricBackground,
  metricColor as chartMetricColor,
  roundPercent as calculatePercent,
  withRemainderMetric as appendRemainderMetric,
} from '../../shared/utils/chart-metric.util';
import { FOOTER_CREDENTIAL_LINKS, VNSC_LOGO_SRC } from '../home/home.data';

type SourceGroupFilter = NonNullable<StatsDashboardQueryDto['sourceGroup']>;
type ImageFilter = NonNullable<StatsDashboardQueryDto['hasImage']>;
type DonutMetric = ChartMetricItem;
type DashboardTab = 'overview' | 'group-detail';
type GroupVisualMode = 'bar' | 'donut';
type RegionYearGroup = {
  region: string;
  totalOccurrence: number;
  totalSpecies: number;
  years: StatsRegionYearMetric[];
};

@Component({
  selector: 'app-statistics-page',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    DashboardMetricStripComponent,
    SiteHeaderComponent,
    CredentialsFooterComponent,
  ],
  templateUrl: './statistics.page.html',
  styleUrl: './statistics.page.css',
})
export class StatisticsPage {
  private readonly statsService = inject(StatsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly dashboard = signal<StatsDashboard | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly sourceGroup = signal<SourceGroupFilter>('all');
  readonly appliedSourceGroup = signal<SourceGroupFilter>('all');
  readonly yearFrom = signal('');
  readonly yearTo = signal('');
  readonly basisOfRecord = signal('all');
  readonly hasImage = signal<ImageFilter>('all');
  readonly activeTab = signal<DashboardTab>('overview');
  readonly groupVisualMode = signal<GroupVisualMode>('bar');
  protected readonly footerLinks = FOOTER_CREDENTIAL_LINKS;
  protected readonly vnscLogoSrc = VNSC_LOGO_SRC;

  readonly recentYears = computed(() => this.dashboard()?.occurrencesByYear.slice(-32) ?? []);
  readonly maxYearOccurrence = computed(() => Math.max(1, ...this.recentYears().map((item) => item.occurrenceCount)));
  readonly maxRegionOccurrence = computed(() =>
    Math.max(1, ...(this.dashboard()?.occurrencesByRegion.map((item) => item.occurrenceCount) ?? [1])),
  );
  readonly maxBasisCount = computed(() =>
    Math.max(1, ...(this.dashboard()?.basisOfRecord.map((item) => item.count) ?? [1])),
  );
  readonly speciesGroupTotal = computed(() =>
    (this.dashboard()?.speciesGroups ?? []).reduce((total, item) => total + item.speciesCount, 0),
  );
  readonly regionBreakdown = computed(() => this.buildRegionBreakdown(this.dashboard()?.regionGroupBreakdown ?? []));
  readonly regionSpeciesComposition = computed(() =>
    this.buildSpeciesShareGroups(this.dashboard()?.regionSpeciesComposition ?? [], 'region'),
  );
  readonly regionYearGroups = computed(() => this.buildRegionYearGroups(this.dashboard()?.regionYearBreakdown ?? []));
  readonly maxRegionYearOccurrence = computed(() =>
    Math.max(1, ...this.regionYearGroups().flatMap((group) => group.years.map((year) => year.occurrenceCount))),
  );
  readonly selectedGroupLabel = computed(() => this.resolveGroupLabel(this.appliedSourceGroup()));
  readonly isGroupFiltered = computed(() => this.appliedSourceGroup() !== 'all');
  readonly speciesDonutItems = computed(() => this.buildSpeciesDonut(this.dashboard()?.speciesRanking ?? []));
  readonly regionDonutItems = computed(() => this.buildRegionDonut(this.dashboard()?.occurrencesByRegion ?? []));
  readonly summaryMetrics = computed<DashboardMetricItem[]>(() => {
    const summary = this.dashboard()?.summary;

    if (!summary) {
      return [];
    }

    return [
      { label: 'Tổng số loài', value: summary.totalSpecies },
      { label: 'Occurrence', value: summary.totalOccurrences },
      { label: 'Vùng ghi nhận', value: summary.totalRegions },
      { label: 'Occurrence có ảnh', value: summary.imageCount },
    ];
  });

  constructor() {
    if (this.isBrowser) {
      this.loadDashboard();
      return;
    }

    this.isLoading.set(false);
  }

  loadDashboard(): void {
    if (!this.isBrowser) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    const appliedSourceGroup = this.sourceGroup();

    this.statsService
      .getDashboard({
        sourceGroup: appliedSourceGroup,
        yearFrom: String(this.yearFrom() ?? '').trim(),
        yearTo: String(this.yearTo() ?? '').trim(),
        basisOfRecord: this.basisOfRecord(),
        hasImage: this.hasImage(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dashboard) => {
          this.dashboard.set(dashboard);
          this.appliedSourceGroup.set(appliedSourceGroup);
          this.activeTab.set(appliedSourceGroup === 'all' ? 'overview' : 'group-detail');
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Không tải được dữ liệu thống kê. Kiểm tra API hoặc kết nối database rồi thử lại.');
          this.isLoading.set(false);
        },
      });
  }

  clearFilters(): void {
    this.sourceGroup.set('all');
    this.yearFrom.set('');
    this.yearTo.set('');
    this.basisOfRecord.set('all');
    this.hasImage.set('all');
  }

  updateSourceGroup(value: string): void {
    this.sourceGroup.set(value as SourceGroupFilter);
  }

  updateHasImage(value: string): void {
    this.hasImage.set(value as ImageFilter);
  }

  updateBasisOfRecord(value: string): void {
    this.basisOfRecord.set(value);
  }

  updateYearFrom(value: string | number | null): void {
    this.yearFrom.set(value === null ? '' : String(value));
  }

  updateYearTo(value: string | number | null): void {
    this.yearTo.set(value === null ? '' : String(value));
  }

  showTab(tab: DashboardTab): void {
    if (tab === 'overview' && this.isGroupFiltered()) {
      this.activeTab.set('group-detail');
      return;
    }

    if (tab === 'group-detail' && !this.isGroupFiltered()) {
      this.activeTab.set('overview');
      return;
    }

    this.activeTab.set(tab);
  }

  setGroupVisualMode(mode: GroupVisualMode): void {
    this.groupVisualMode.set(mode);
  }

  exportDashboardCsv(): void {
    const dashboard = this.dashboard();

    if (!dashboard || !this.isBrowser) {
      return;
    }

    const rows: string[][] = [
      ['section', 'name', 'value', 'extra'],
      ['summary', 'totalSpecies', String(dashboard.summary.totalSpecies), ''],
      ['summary', 'totalOccurrences', String(dashboard.summary.totalOccurrences), ''],
      ['summary', 'totalRegions', String(dashboard.summary.totalRegions), ''],
      ['summary', 'imageCount', String(dashboard.summary.imageCount), ''],
      ...dashboard.speciesGroups.map((item) => [
        'species_group',
        item.label,
        String(item.speciesCount),
        `${item.occurrenceCount} occurrence`,
      ]),
      ...dashboard.occurrencesByYear.map((item) => [
        'year',
        String(item.year),
        String(item.occurrenceCount),
        `${item.speciesCount} species`,
      ]),
      ...dashboard.occurrencesByRegion.map((item) => [
        'region',
        item.region,
        String(item.occurrenceCount),
        `${item.speciesCount} species`,
      ]),
      ...dashboard.taxonomyHighlights.map((item) => [
        `taxonomy_${item.rank}`,
        item.canonicalName,
        String(item.occurrenceCount),
        `${item.speciesCount} species / ${item.regionCount} regions`,
      ]),
      ...dashboard.basisOfRecord.map((item) => ['basis_of_record', item.name, String(item.count), '']),
      ...dashboard.speciesRanking.map((item) => [
        'species_ranking',
        item.vietnameseName || item.scientificName || item.speciesId,
        String(item.occurrenceCount),
        item.family || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `vn-biodiversity-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  barWidth(value: number, max: number): string {
    return `${Math.max(3, Math.round((value / Math.max(1, max)) * 100))}%`;
  }

  groupRatio(group: StatsGroupMetric, total: number): number {
    return total ? Math.round((group.speciesCount / total) * 100) : 0;
  }

  yearHeight(year: StatsYearMetric): string {
    return `${Math.max(6, Math.round((year.occurrenceCount / this.maxYearOccurrence()) * 100))}%`;
  }

  regionYearHeight(year: StatsRegionYearMetric): string {
    return `${Math.max(6, Math.round((year.occurrenceCount / this.maxRegionYearOccurrence()) * 100))}%`;
  }

  groupColor(key: string): string {
    if (key === 'plant') {
      return '#78b86f';
    }

    if (key === 'insect') {
      return '#d69a36';
    }

    return '#1f7a4e';
  }

  regionGroupShare(group: StatsRegionGroupMetric, regionTotal: number): string {
    return this.barWidth(group.occurrenceCount, regionTotal);
  }

  speciesShareWidth(species: StatsSpeciesShareMetric): string {
    return `${Math.max(4, Math.round(species.sharePercent))}%`;
  }

  regionRatio(region: StatsRegionMetric): number {
    const total = this.dashboard()?.summary.totalOccurrences ?? 0;
    return this.roundPercent(region.occurrenceCount, total);
  }

  speciesRankingRatio(species: StatsSpeciesRanking): number {
    const total = this.dashboard()?.summary.totalOccurrences ?? 0;
    return this.roundPercent(species.occurrenceCount, total);
  }

  speciesRankingWidth(species: StatsSpeciesRanking): string {
    return `${Math.max(4, this.speciesRankingRatio(species))}%`;
  }

  regionSpeciesDonutItems(regionKey: string): DonutMetric[] {
    const speciesGroup = this.regionSpeciesComposition().find((group) => group.key === regionKey);

    if (!speciesGroup) {
      return [];
    }

    const visibleItems = speciesGroup.items.slice(0, 6).map((species, index) => ({
      key: `${species.sourceTable}-${species.speciesId}`,
      label: species.vietnameseName || species.scientificName || 'Chưa rõ tên',
      value: species.occurrenceCount,
      percent: species.sharePercent,
      color: this.metricColor(index),
      detailUrl: species.detailUrl,
    }));

    return this.withRemainderMetric(visibleItems, speciesGroup.totalOccurrence, 'Loài còn lại');
  }

  observedRange(dashboard: StatsDashboard): string {
    const from = dashboard.summary.earliestObservedYear ?? 'Chưa rõ';
    const to = dashboard.summary.latestObservedYear ?? 'Chưa rõ';
    return `${from} - ${to}`;
  }

  metricColor(index: number): string {
    return chartMetricColor(index);
  }

  donutMetricBackground(items: DonutMetric[], normalizeByValue = false): string {
    return buildDonutMetricBackground(items, normalizeByValue);
  }

  visibleDonutCount(items: DonutMetric[]): number {
    return items.filter((item) => !item.isRemainder).length;
  }

  private buildSpeciesShareGroups(rows: StatsSpeciesShareMetric[], mode: 'sourceGroup' | 'region') {
    const groupMap = new Map<
      string,
      {
        key: string;
        label: string;
        totalOccurrence: number;
        items: StatsSpeciesShareMetric[];
      }
    >();

    for (const row of rows) {
      const key = mode === 'sourceGroup' ? row.sourceGroup : row.region ?? 'Chưa rõ vùng';
      const label = mode === 'sourceGroup' ? row.sourceGroupLabel : row.region ?? 'Chưa rõ vùng';
      const current =
        groupMap.get(key) ??
        {
          key,
          label,
          totalOccurrence: row.totalOccurrence,
          items: [],
        };

      current.totalOccurrence = Math.max(current.totalOccurrence, row.totalOccurrence);
      current.items.push(row);
      groupMap.set(key, current);
    }

    return Array.from(groupMap.values()).sort((left, right) => right.totalOccurrence - left.totalOccurrence);
  }

  private buildRegionBreakdown(rows: StatsRegionGroupMetric[]) {
    const regionMap = new Map<
      string,
      { region: string; totalOccurrence: number; totalSpecies: number; groups: StatsRegionGroupMetric[] }
    >();

    for (const row of rows) {
      const current =
        regionMap.get(row.region) ??
        {
          region: row.region,
          totalOccurrence: 0,
          totalSpecies: 0,
          groups: [],
        };

      current.totalOccurrence += row.occurrenceCount;
      current.totalSpecies += row.speciesCount;
      current.groups.push(row);
      regionMap.set(row.region, current);
    }

    return Array.from(regionMap.values()).sort((left, right) => right.totalOccurrence - left.totalOccurrence);
  }

  private buildRegionYearGroups(rows: StatsRegionYearMetric[]): RegionYearGroup[] {
    const regionMap = new Map<string, RegionYearGroup>();

    for (const row of rows) {
      const current =
        regionMap.get(row.region) ??
        {
          region: row.region,
          totalOccurrence: 0,
          totalSpecies: 0,
          years: [],
        };

      current.totalOccurrence += row.occurrenceCount;
      current.totalSpecies = Math.max(current.totalSpecies, row.speciesCount);
      current.years.push(row);
      regionMap.set(row.region, current);
    }

    return Array.from(regionMap.values()).sort((left, right) => right.totalOccurrence - left.totalOccurrence);
  }

  private buildSpeciesDonut(rows: StatsSpeciesRanking[]): DonutMetric[] {
    const total = Math.max(1, this.dashboard()?.summary.totalOccurrences ?? 1);

    const visibleItems = rows.slice(0, 12).map((species, index) => ({
      key: `${species.sourceTable}-${species.speciesId}`,
      label: species.vietnameseName || species.scientificName || 'Chưa rõ tên',
      value: species.occurrenceCount,
      percent: this.roundPercent(species.occurrenceCount, total),
      color: this.metricColor(index),
      detailUrl: species.detailUrl,
    }));

    return this.withRemainderMetric(visibleItems, total, 'Loài còn lại');
  }

  private buildRegionDonut(rows: StatsRegionMetric[]): DonutMetric[] {
    const total = Math.max(1, rows.reduce((sum, region) => sum + region.occurrenceCount, 0));

    const visibleItems = rows.slice(0, 8).map((region, index) => ({
      key: region.region,
      label: region.region,
      value: region.occurrenceCount,
      percent: this.roundPercent(region.occurrenceCount, total),
      color: this.metricColor(index),
    }));

    return this.withRemainderMetric(visibleItems, total, 'Vùng còn lại');
  }

  private withRemainderMetric(items: DonutMetric[], total: number, label: string): DonutMetric[] {
    return appendRemainderMetric(items, total, label);
  }

  private roundPercent(value: number, total: number): number {
    return calculatePercent(value, total);
  }

  private resolveGroupLabel(group: SourceGroupFilter): string {
    if (group === 'animal') {
      return 'Động vật';
    }

    if (group === 'plant') {
      return 'Thực vật';
    }

    if (group === 'insect') {
      return 'Côn trùng';
    }

    return 'Toàn bộ nhóm sinh vật';
  }

  donutBackground(groups: StatsGroupMetric[]): string {
    const total = groups.reduce((sum, group) => sum + group.speciesCount, 0);

    if (!total) {
      return 'conic-gradient(#dcebe1 0deg 360deg)';
    }

    let cursor = 0;
    const segments = groups.map((group) => {
      const start = cursor;
      cursor += (group.speciesCount / total) * 360;
      return `${this.groupColor(group.key)} ${start}deg ${cursor}deg`;
    });

    return `conic-gradient(${segments.join(', ')})`;
  }
}

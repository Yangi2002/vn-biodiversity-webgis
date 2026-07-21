import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdminNavbarComponent } from '../components/admin-navbar/admin-navbar.component';
import type { AdminTab } from '../components/admin-navbar/admin-navbar.component';
import type { AdminMainDataTable } from '../services/admin-main-data.store';
import { AdminMainDataStore } from '../services/admin-main-data.store';

@Component({
  selector: 'app-data-governance-page',
  imports: [AdminNavbarComponent, DecimalPipe, RouterLink],
  templateUrl: './data-governance.page.html',
  styleUrl: './data-governance.page.css',
})
export class DataGovernancePage {
  private readonly mainDataStore = inject(AdminMainDataStore);

  readonly mainTables = this.mainDataStore.mainTables;
  readonly summaries = this.mainDataStore.summaries;
  readonly activeTab = signal<AdminTab>('data');

  constructor() {
    this.mainDataStore.ensureLoaded();
  }

  summaryFor(table: AdminMainDataTable) {
    return this.summaries()[table.sourceTable];
  }

  totalRecords() {
    return Object.values(this.summaries()).reduce((sum, summary) => sum + summary.total, 0);
  }

  reload() {
    this.mainDataStore.reload();
  }

  goToPage(table: AdminMainDataTable, page: number) {
    this.mainDataStore.loadPage(table, page);
  }

  setActiveTab(tab: AdminTab) {
    this.activeTab.set(tab);
  }
}

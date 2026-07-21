import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  imports: [],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
})
export class PaginationComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) totalPages = 1;
  @Input() total = 0;
  @Input() limit = 0;
  @Input() label = 'Phân trang';
  @Input() itemLabel = 'mục';
  @Input() compact = false;

  @Output() readonly pageChange = new EventEmitter<number>();

  protected get hasPreviousPage(): boolean {
    return this.page > 1;
  }

  protected get hasNextPage(): boolean {
    return this.page < this.totalPages;
  }

  protected get pageNumbers(): number[] {
    if (this.compact) {
      return [];
    }

    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, this.page + 2);
    const pages: number[] = [];

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.pageChange.emit(page);
  }
}

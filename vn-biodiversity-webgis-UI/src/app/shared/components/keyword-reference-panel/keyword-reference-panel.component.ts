import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { SpeciesKeywordImage, SpeciesKeywordReference } from '../../../data-access/models/species.model';

@Component({
  selector: 'app-keyword-reference-panel',
  templateUrl: './keyword-reference-panel.component.html',
  styleUrl: './keyword-reference-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordReferencePanelComponent {
  readonly keywords = input<readonly SpeciesKeywordReference[]>([]);
  readonly selectedKeywordId = input<string | null>(null);
  readonly isExpanded = input(false);
  readonly keywordSelected = output<SpeciesKeywordReference>();
  readonly expandedChange = output<boolean>();
  protected readonly previewImage = signal<SpeciesKeywordImage | null>(null);

  protected readonly activeKeyword = computed(() => {
    const keywords = this.keywords();
    const selectedId = this.selectedKeywordId();

    return keywords.find((keyword) => keyword.keywordId === selectedId) ?? keywords[0] ?? null;
  });

  protected selectKeyword(keywordId: string): void {
    const keyword = this.keywords().find((item) => item.keywordId === keywordId);

    if (keyword) {
      this.keywordSelected.emit(keyword);
    }
  }

  protected toggleExpanded(): void {
    this.expandedChange.emit(!this.isExpanded());
  }

  protected closeDialog(): void {
    this.previewImage.set(null);
    this.expandedChange.emit(false);
  }

  protected openImagePreview(image: SpeciesKeywordImage): void {
    this.previewImage.set(image);
  }

  protected closeImagePreview(): void {
    this.previewImage.set(null);
  }

  protected externalUrl(keyword: SpeciesKeywordReference): string {
    return keyword.detailUrl || keyword.keywordUrl;
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { SpeciesKeywordReference } from '../../../data-access/models/species.model';

type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'keyword'; text: string; keyword: SpeciesKeywordReference };

@Component({
  selector: 'app-keyword-rich-text',
  templateUrl: './keyword-rich-text.component.html',
  styleUrl: './keyword-rich-text.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordRichTextComponent {
  readonly text = input('');
  readonly keywords = input<readonly SpeciesKeywordReference[]>([]);
  readonly keywordSelected = output<SpeciesKeywordReference>();

  protected readonly segments = computed(() => this.createSegments(this.text(), this.keywords()));

  protected selectKeyword(keyword: SpeciesKeywordReference): void {
    this.keywordSelected.emit(keyword);
  }

  private createSegments(text: string, keywords: readonly SpeciesKeywordReference[]): TextSegment[] {
    const uniqueKeywords = this.uniqueKeywords(keywords);

    if (!text || !uniqueKeywords.length) {
      return [{ kind: 'text', text }];
    }

    const escapedKeywords = uniqueKeywords.map((keyword) => this.escapeRegExp(keyword.keywordTextInDetail));
    const matcher = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
    const segments: TextSegment[] = [];
    let cursor = 0;

    for (const match of text.matchAll(matcher)) {
      const value = match[0];
      const index = match.index ?? 0;

      if (index > cursor) {
        segments.push({ kind: 'text', text: text.slice(cursor, index) });
      }

      const keyword = uniqueKeywords.find(
        (item) => item.keywordTextInDetail.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'),
      );

      if (keyword) {
        segments.push({ kind: 'keyword', text: value, keyword });
      } else {
        segments.push({ kind: 'text', text: value });
      }

      cursor = index + value.length;
    }

    if (cursor < text.length) {
      segments.push({ kind: 'text', text: text.slice(cursor) });
    }

    return segments;
  }

  private uniqueKeywords(keywords: readonly SpeciesKeywordReference[]): SpeciesKeywordReference[] {
    const seen = new Set<string>();

    return keywords
      .filter((keyword) => keyword.keywordTextInDetail.trim().length > 1)
      .sort((a, b) => b.keywordTextInDetail.length - a.keywordTextInDetail.length)
      .filter((keyword) => {
        const key = keyword.keywordTextInDetail.toLocaleLowerCase('vi');

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

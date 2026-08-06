import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { NationalParkDetail } from '../../../data-access/models/national-park.model';
import { NationalParkService } from '../../../data-access/services/national-park.service';
import { SiteHeaderComponent } from '../../../shared/components/site-header/site-header.component';

interface NationalParkSection {
  title: string;
  content: string;
}

interface NationalParkInfoRow {
  label: string;
  value: string;
}

interface NationalParkImageItem {
  url: string;
  caption: string;
}

interface NationalParkRawSection {
  title?: unknown;
  heading?: unknown;
  name?: unknown;
  content?: unknown;
  text?: unknown;
  body?: unknown;
  value?: unknown;
}

const DETAIL_SECTION_LABELS: Record<string, string> = {
  ban_quan_ly: 'Ban quản lý',
  cac_du_an_co_lien_quan: 'Các dự án có liên quan',
  cac_gia_tri_da_dang_sinh_hoc: 'Các giá trị đa dạng sinh học',
  co_quan_cap_quan_ly: 'Cơ quan/cấp quản lý',
  co_quan_quan_ly: 'Cơ quan quản lý',
  dan_so_trong_vung: 'Dân số trong vùng',
  du_an_lien_quan: 'Dự án liên quan',
  he_dong_vat: 'Hệ động vật',
  he_thuc_vat: 'Hệ thực vật',
  hoat_dong_du_lich: 'Hoạt động du lịch',
  muc_tieu_nhiem_vu: 'Mục tiêu, nhiệm vụ',
  nguon_tham_khao: 'Nguồn tham khảo',
  quy_mo_dien_tich: 'Quy mô diện tích',
  quyet_dinh_thanh_lap: 'Quyết định thành lập',
  toa_do_dia_ly: 'Tọa độ địa lý',
  tom_tat: 'Tóm tắt',
  vi_tri_dia_ly: 'Vị trí địa lý',
};

@Component({
  selector: 'app-national-park-detail-page',
  imports: [DecimalPipe, RouterLink, SiteHeaderComponent],
  templateUrl: './national-park-detail.page.html',
  styleUrl: './national-park-detail.page.css',
})
export class NationalParkDetailPage {
  protected readonly park = signal<NationalParkDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');

  private readonly route = inject(ActivatedRoute);
  private readonly nationalParkService = inject(NationalParkService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const parkId = params.get('parkId');

      if (!parkId) {
        this.errorMessage.set('Thiếu định danh vườn quốc gia.');
        this.isLoading.set(false);
        return;
      }

      this.loadDetail(parkId);
    });
  }

  protected displayTitle(park: NationalParkDetail): string {
    return park.title ?? park.mapPopupTitle ?? 'Vườn quốc gia Việt Nam';
  }

  protected heroImage(park: NationalParkDetail): string {
    return this.imageGallery(park)[0]?.url ?? park.primaryImageUrl ?? park.thumbnailUrl ?? '';
  }

  protected imageGallery(park: NationalParkDetail): NationalParkImageItem[] {
    const captions = park.imageCaptions.map((caption) => this.cleanText(caption));
    const images = [...park.imageUrls, park.primaryImageUrl, park.thumbnailUrl].filter(
      (imageUrl): imageUrl is string => Boolean(imageUrl),
    );
    const uniqueImages = this.uniqueImageUrls(images);

    return uniqueImages.map((url, index) => ({
      url,
      caption: captions[index] || `${this.displayTitle(park)} - ảnh ${index + 1}`,
    }));
  }

  protected authorText(park: NationalParkDetail): string {
    return this.cleanText(park.author) || 'Nguồn dữ liệu vườn quốc gia';
  }

  private uniqueImageUrls(imageUrls: string[]): string[] {
    const seen = new Set<string>();

    return imageUrls.filter((imageUrl) => {
      const key = this.imageUrlKey(imageUrl);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private imageUrlKey(value: string): string {
    const normalizedValue = value
      .trim()
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^(\/api)+(?=\/)/i, '/api')
      .replace(/\/+$/, '');

    const nationalParkImageMatch = normalizedValue.match(/\/national-parks\/([^/]+)\/images\/(\d+)/i);

    if (nationalParkImageMatch) {
      return `national-park:${decodeURIComponent(nationalParkImageMatch[1])}:image:${nationalParkImageMatch[2]}`;
    }

    return normalizedValue.toLowerCase();
  }

  protected publishedText(park: NationalParkDetail): string {
    return (
      this.findPayloadText(park.sourcePayload, ['published_date', 'publishedDate', 'post_date', 'date', 'created_at']) ||
      'Chưa rõ ngày công bố'
    );
  }

  protected introText(park: NationalParkDetail): string {
    return this.cleanText(park.summaryText) || this.cleanText(park.mapPopupExcerpt) || '';
  }

  protected articleSections(park: NationalParkDetail): NationalParkSection[] {
    return this.articleSectionsFromFields(park);

    const contentSections = this.sectionsFromContentText(park.contentText);
    const sections: NationalParkSection[] = [
      ...contentSections,
      ...(contentSections.length
        ? []
        : [
            { title: 'Tóm tắt', content: park.summaryText ?? '' },
            { title: 'Quyết định thành lập', content: park.establishmentDecision ?? '' },
            { title: 'Quy mô diện tích', content: park.areaText ?? '' },
            { title: 'Vị trí địa lý', content: park.geographicLocation ?? '' },
            { title: 'Tọa độ địa lý', content: park.coordinateText ?? '' },
            { title: 'Mục tiêu, nhiệm vụ', content: park.objectiveMission ?? '' },
            { title: 'Cơ quan quản lý', content: park.parentAgency ?? '' },
            { title: 'Ban quản lý', content: park.managementBoard ?? '' },
            { title: 'Đa dạng sinh học', content: park.biodiversity ?? '' },
            { title: 'Hệ thực vật', content: park.flora ?? '' },
            { title: 'Hệ động vật', content: park.fauna ?? '' },
            { title: 'Hoạt động du lịch', content: park.tourismActivities ?? '' },
            { title: 'Dự án liên quan', content: park.relatedProjects ?? '' },
            { title: 'Dân số trong vùng', content: park.populationInArea ?? '' },
            { title: 'Nguồn tham khảo', content: park.references ?? '' },
          ]),
      ...(contentSections.length ? [] : this.sectionsFromDetailJson(park.detailSections)),
    ];

    const seenTitles = new Set<string>();
    const seenContent = new Set<string>();

    return sections
      .map((section) => ({
        title: this.cleanSectionTitle(section.title),
        content: this.cleanSectionContent(section.title, section.content),
      }))
      .filter((section) => section.title.length > 0 && section.content.length > 0)
      .filter((section) => {
        const titleKey = this.sectionDedupeKey(section.title);
        const contentKey = this.normalizeContent(section.content);

        if (seenTitles.has(titleKey) || seenContent.has(contentKey)) {
          return false;
        }

        seenTitles.add(titleKey);
        seenContent.add(contentKey);
        return true;
      });
  }

  protected contentParagraphs(park: NationalParkDetail): string[] {
    if (this.articleSections(park).length) {
      return [];
    }

    return this.paragraphs(park.contentText);
  }

  protected paragraphs(value: string | null): string[] {
    const text = this.cleanText(value);

    if (!text) {
      return [];
    }

    return text
      .split(/\n{2,}|\r?\n(?=[A-ZÀ-ỸĐ][^:]{0,80}:)/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  protected quickInfoRows(park: NationalParkDetail): NationalParkInfoRow[] {
    return [
      { label: 'Diện tích', value: this.shortText(park.areaText, 140) },
      { label: 'Tọa độ', value: this.shortText(this.cleanCoordinateText(park.coordinateText), 140) },
      { label: 'Tỉnh/vùng', value: this.shortText(park.geographicLocation, 170) },
      { label: 'Cơ quan quản lý', value: this.shortText(park.managementAgency ?? park.parentAgency, 150) },
    ]
      .map((row) => ({ ...row, value: this.cleanText(row.value) }))
      .filter((row) => row.value.length > 0);

    return [
      { label: 'Diện tích', value: park.areaText ?? '' },
      { label: 'Tọa độ', value: this.cleanCoordinateText(park.coordinateText) },
      { label: 'Cơ quan quản lý', value: park.managementAgency ?? park.parentAgency ?? '' },
      { label: 'Ban quản lý', value: park.managementBoard ?? '' },
      { label: 'Nguồn dữ liệu', value: park.source ?? '' },
      { label: 'Số ảnh', value: String(this.imageGallery(park).length || park.imageCount || 0) },
    ]
      .map((row) => ({ ...row, value: this.cleanText(row.value) }))
      .filter((row) => row.value.length > 0);
  }

  protected externalUrl(park: NationalParkDetail): string {
    return park.detailUrl ?? park.mapUrl ?? '#';
  }

  private loadDetail(parkId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.nationalParkService
      .getDetail(parkId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.park.set(detail);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('Chưa tải được hồ sơ vườn quốc gia.');
          this.isLoading.set(false);
        },
      });
  }

  private articleSectionsFromFields(park: NationalParkDetail): NationalParkSection[] {
    const fieldSections = this.cleanAndDedupeSections([
      { title: 'Giới thiệu', content: this.introText(park) },
      { title: 'Vị trí địa lý', content: park.geographicLocation ?? '' },
      { title: 'Tọa độ địa lý', content: this.cleanCoordinateText(park.coordinateText) },
      ...this.areaSections(park.areaText),
      { title: 'Quyết định thành lập', content: park.establishmentDecision ?? '' },
      { title: 'Mục tiêu, nhiệm vụ', content: park.objectiveMission ?? '' },
      { title: 'Cơ quan quản lý', content: park.parentAgency ?? '' },
      { title: 'Ban quản lý', content: park.managementBoard ?? '' },
      { title: 'Đa dạng sinh học', content: park.biodiversity ?? '' },
      { title: 'Hệ thực vật', content: park.flora ?? '' },
      { title: 'Hệ động vật', content: park.fauna ?? '' },
      { title: 'Du lịch', content: park.tourismActivities ?? '' },
      { title: 'Dự án liên quan', content: park.relatedProjects ?? '' },
      { title: 'Dân số trong vùng', content: park.populationInArea ?? '' },
      { title: 'Nguồn tham khảo', content: park.references ?? '' },
      ...this.sectionsFromDetailJson(park.detailSections),
    ]);

    return fieldSections.length ? fieldSections : this.cleanAndDedupeSections(this.sectionsFromContentText(park.contentText));
  }

  private areaSections(value: string | null): NationalParkSection[] {
    const text = this.cleanText(value);

    if (!text) {
      return [];
    }

    const coreMatch = text.match(/\bVùng lõi\s*:\s*([\s\S]*?)(?=\bVùng đệm\s*:|$)/i);
    const bufferMatch = text.match(/\bVùng đệm\s*:\s*([\s\S]*)$/i);
    const areaOnly = text
      .replace(/\bVùng lõi\s*:\s*[\s\S]*?(?=\bVùng đệm\s*:|$)/i, '')
      .replace(/\bVùng đệm\s*:\s*[\s\S]*$/i, '')
      .trim();

    return [
      { title: 'Quy mô và diện tích', content: areaOnly || text },
      { title: 'Vùng lõi', content: coreMatch?.[1] ?? '' },
      { title: 'Vùng đệm', content: bufferMatch?.[1] ?? '' },
    ];
  }

  private cleanAndDedupeSections(sections: NationalParkSection[]): NationalParkSection[] {
    const seenTitles = new Set<string>();
    const seenContent = new Set<string>();

    return sections
      .map((section) => ({
        title: this.cleanSectionTitle(section.title),
        content: this.cleanSectionContent(section.title, section.content),
      }))
      .filter((section) => section.title.length > 0 && section.content.length > 0)
      .filter((section) => {
        const titleKey = this.sectionDedupeKey(section.title);
        const contentKey = this.normalizeContent(section.content);

        if (seenTitles.has(titleKey) || seenContent.has(contentKey)) {
          return false;
        }

        seenTitles.add(titleKey);
        seenContent.add(contentKey);
        return true;
      });
  }

  private sectionsFromDetailJson(value: unknown): NationalParkSection[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.sectionFromUnknown(item, ''))
        .filter((section): section is NationalParkSection => Boolean(section));
    }

    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => this.sectionFromUnknown(item, this.sectionTitleFromKey(key)))
      .filter((section): section is NationalParkSection => Boolean(section));
  }

  private sectionsFromContentText(value: string | null): NationalParkSection[] {
    const text = this.cleanText(value);

    if (!text) {
      return [];
    }

    const markers = Array.from(
      text.matchAll(
        /(?:^|\s)(\d+)\.\s+(Vị trí địa lý|Quy mô và diện tích|Chức năng,\s*nhiệm vụ|Đa dạng sinh học[^.]*|Du lịch tại[^.]*)(?=\s)/g,
      ),
    );

    if (markers.length < 2) {
      return [];
    }

    return markers
      .map((match, index) => {
        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < markers.length ? markers[index + 1].index ?? text.length : text.length;
        const title = this.cleanSectionTitle(match[2]);
        const content = this.cleanText(text.slice(start, end));

        return title && content ? { title, content } : null;
      })
      .filter((section): section is NationalParkSection => Boolean(section));
  }

  private sectionFromUnknown(item: unknown, fallbackTitle: string): NationalParkSection | null {
    if (typeof item === 'string') {
      const content = this.cleanText(item);

      return fallbackTitle && content ? { title: fallbackTitle, content } : null;
    }

    if (!item || typeof item !== 'object') {
      return null;
    }

    const section = item as NationalParkRawSection;
      const title = this.cleanSectionTitle(section.title ?? section.heading ?? section.name) || fallbackTitle;
    const content = this.cleanText(section.content ?? section.text ?? section.body ?? section.value);

    return title && content ? { title, content } : null;
  }

  private sectionTitleFromKey(key: string): string {
    const normalizedKey = this.normalizeSectionKey(key);

    return DETAIL_SECTION_LABELS[normalizedKey] ?? this.cleanSectionTitle(key.replace(/[_-]+/g, ' '));
  }

  private normalizeSectionKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private sectionDedupeKey(title: string): string {
    const key = this.normalizeSectionKey(this.cleanSectionTitle(title));
    const aliases: Record<string, string> = {
      cac_du_an_co_lien_quan: 'du_an_lien_quan',
      cac_gia_tri_da_dang_sinh_hoc: 'da_dang_sinh_hoc',
      co_quan_cap_quan_ly: 'co_quan_quan_ly',
      quy_mo_dien_tich: 'dien_tich',
      tong_dien_tich: 'dien_tich',
    };

    return aliases[key] ?? key;
  }

  private cleanSectionTitle(value: unknown): string {
    return this.cleanText(value).replace(/^\d+\s*[.)]\s*/, '');
  }

  private cleanCoordinateText(value: unknown): string {
    return this.cutBeforeNextSection(this.cleanText(value), [
      /\b2\s*[.)]\s*Quy\s*m[oô]\s*v[aà]\s*di[eệ]n\s*t[ií]ch\b/i,
      /\bQuy\s*m[oô]\s*v[aà]\s*di[eệ]n\s*t[ií]ch\b/i,
      /\b3\s*[.)]\s*Ch[uứ]c\s*n[aă]ng\b/i,
      /\b4\s*[.)]\s*[ĐD]a\s*d[aạ]ng\s*sinh\s*h[oọ]c\b/i,
    ]);
  }

  private cleanSectionContent(title: string, content: unknown): string {
    const text = this.cleanText(content);
    const key = this.sectionDedupeKey(title);

    if (key === 'toa_do_dia_ly') {
      return this.cutBeforeNextSection(text, [
        /\b2\s*[.)]\s*Quy\s*m[oô]\s*v[aà]\s*di[eệ]n\s*t[ií]ch\b/i,
        /\bQuy\s*m[oô]\s*v[aà]\s*di[eệ]n\s*t[ií]ch\b/i,
      ]);
    }

    if (key === 'dien_tich') {
      return this.cutBeforeNextSection(text, [
        /\b3\s*[.)]\s*Ch[uứ]c\s*n[aă]ng\b/i,
        /\bCh[uứ]c\s*n[aă]ng,\s*nhi[eệ]m\s*v[uụ]\b/i,
      ]);
    }

    if (key === 'muc_tieu_nhiem_vu') {
      return this.cutBeforeNextSection(text, [
        /\b4\s*[.)]\s*[ĐD]a\s*d[aạ]ng\s*sinh\s*h[oọ]c\b/i,
        /\b[ĐD]a\s*d[aạ]ng\s*sinh\s*h[oọ]c\b/i,
      ]);
    }

    if (key === 'da_dang_sinh_hoc') {
      return this.cutBeforeNextSection(text, [
        /\b5\s*[.)]\s*Du\s*l[iị]ch\b/i,
        /\bDu\s*l[iị]ch\s*t[aạ]i\b/i,
      ]);
    }

    return text;
  }

  private cutBeforeNextSection(text: string, patterns: RegExp[]): string {
    const indexes = patterns
      .map((pattern) => text.search(pattern))
      .filter((index) => index > 0);

    if (!indexes.length) {
      return text;
    }

    return text.slice(0, Math.min(...indexes)).trim();
  }

  private normalizeContent(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private cleanText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private shortText(value: unknown, maxLength: number): string {
    const text = this.cleanText(value);

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
  }

  private findPayloadText(payload: unknown, keys: string[]): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const record = payload as Record<string, unknown>;

    for (const key of keys) {
      const value = record[key];
      const text = this.cleanText(value);

      if (text) {
        return text;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        const found = this.findPayloadText(value, keys);

        if (found) {
          return found;
        }
      }
    }

    return '';
  }
}

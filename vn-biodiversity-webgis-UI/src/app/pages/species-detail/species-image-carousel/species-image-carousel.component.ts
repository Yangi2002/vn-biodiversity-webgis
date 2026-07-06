import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface SpeciesCarouselImage {
  imageOrder: number;
  imageUrl: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number;
}

@Component({
  selector: 'app-species-image-carousel',
  templateUrl: './species-image-carousel.component.html',
  styleUrl: './species-image-carousel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeciesImageCarouselComponent {
  readonly images = input<readonly SpeciesCarouselImage[]>([]);
  readonly speciesName = input.required<string>();
  readonly sourceLabel = input.required<string>();

  protected readonly activeIndex = signal(0);
  protected readonly previewIndex = signal<number | null>(null);
  protected readonly activeImage = computed(() => this.images()[this.activeIndex()]);
  protected readonly previewImage = computed(() => {
    const index = this.previewIndex();

    return index === null ? null : this.images()[index] ?? null;
  });
  protected readonly hasMultipleImages = computed(() => this.images().length > 1);

  protected previous(): void {
    this.setPreview(this.currentPreviewIndex() - 1);
  }

  protected next(): void {
    this.setPreview(this.currentPreviewIndex() + 1);
  }

  protected goTo(index: number): void {
    this.setActive(index);
  }

  protected openPreview(index = this.activeIndex()): void {
    if (this.images().length) {
      this.setPreview(index);
    }
  }

  protected closePreview(): void {
    this.previewIndex.set(null);
  }

  protected imageResolution(image: SpeciesCarouselImage): string {
    if (!image.width || !image.height) {
      return 'Chưa có kích thước ảnh';
    }

    return `${image.width} x ${image.height}px`;
  }

  private setActive(index: number): void {
    const total = this.images().length;

    if (total === 0) {
      this.activeIndex.set(0);
      return;
    }

    this.activeIndex.set((index + total) % total);
  }

  private setPreview(index: number): void {
    const total = this.images().length;

    if (total === 0) {
      this.previewIndex.set(null);
      return;
    }

    this.previewIndex.set((index + total) % total);
  }

  private currentPreviewIndex(): number {
    return this.previewIndex() ?? this.activeIndex();
  }
}

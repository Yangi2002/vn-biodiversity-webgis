import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';

export interface SpeciesCarouselImage {
  imageOrder: number;
  imageUrl: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number;
  showpicMetadata?: SpeciesShowpicMetadata | null;
}

export interface SpeciesShowpicMetadata {
  showpicId: string;
  vietnameseName: string | null;
  latinName: string | null;
  author: string | null;
  sourceImageUrl: string | null;
  thumbnailUrl: string | null;
  imagePath: string | null;
  imageLocalPath: string | null;
  imageMimeType: string | null;
  imageFileSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  fetchStatus: string | null;
  errorMessage: string | null;
  showpicUrl: string | null;
  fetchedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  readonly intervalMs = input(5500);

  protected readonly activeIndex = signal(0);
  protected readonly previewIndex = signal<number | null>(null);
  protected readonly activeImage = computed(() => this.images()[this.activeIndex()]);
  protected readonly previewImage = computed(() => {
    const index = this.previewIndex();

    return index === null ? null : this.images()[index] ?? null;
  });
  protected readonly hasMultipleImages = computed(() => this.images().length > 1);
  private readonly destroyRef = inject(DestroyRef);
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const shouldAutoPlay = this.hasMultipleImages() && this.previewIndex() === null;
      const intervalMs = this.intervalMs();

      this.stopAutoPlay();

      if (shouldAutoPlay) {
        this.timerId = setInterval(() => this.setActive(this.activeIndex() + 1), intervalMs);
      }
    });

    this.destroyRef.onDestroy(() => this.stopAutoPlay());
  }

  protected previous(): void {
    this.setPreview(this.currentPreviewIndex() - 1);
  }

  protected next(): void {
    this.setPreview(this.currentPreviewIndex() + 1);
  }

  protected previousActive(): void {
    this.setActive(this.activeIndex() - 1);
  }

  protected nextActive(): void {
    this.setActive(this.activeIndex() + 1);
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
    const width = image.showpicMetadata?.imageWidth ?? image.width;
    const height = image.showpicMetadata?.imageHeight ?? image.height;

    if (!width || !height) {
      return 'Chưa có kích thước ảnh';
    }

    return `${width} x ${height}px`;
  }

  protected fileSize(image: SpeciesCarouselImage): string {
    const size = image.showpicMetadata?.imageFileSize ?? image.sizeBytes;

    if (!size) {
      return 'Chưa có dung lượng';
    }

    if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }

    return `${Math.round(size / 1024)} KB`;
  }

  protected displayImageUrl(image: SpeciesCarouselImage): string {
    return image.imageUrl;
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

  private stopAutoPlay(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}

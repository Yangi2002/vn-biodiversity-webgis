import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import type { HeroSlide } from './hero-slider.types';

@Component({
  selector: 'app-hero-slider',
  templateUrl: './hero-slider.component.html',
  styleUrl: './hero-slider.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSliderComponent {
  readonly slides = input<readonly HeroSlide[]>([]);
  readonly intervalMs = input(6000);

  protected readonly activeIndex = signal(0);
  protected readonly activeSlide = computed(() => this.slides()[this.activeIndex()]);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    this.timerId = setInterval(() => this.next(), this.intervalMs());
    this.destroyRef.onDestroy(() => this.stopAutoPlay());
  }

  protected previous(): void {
    this.setActive(this.activeIndex() - 1);
  }

  protected next(): void {
    this.setActive(this.activeIndex() + 1);
  }

  protected goTo(index: number): void {
    this.setActive(index);
  }

  private setActive(index: number): void {
    const total = this.slides().length;

    if (total === 0) {
      this.activeIndex.set(0);
      return;
    }

    this.activeIndex.set((index + total) % total);
  }

  private stopAutoPlay(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }
}

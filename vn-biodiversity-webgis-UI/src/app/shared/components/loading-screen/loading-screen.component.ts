import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  input,
  signal,
} from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

@Component({
  selector: 'app-loading-screen',
  templateUrl: './loading-screen.component.html',
  styleUrl: './loading-screen.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingScreenComponent {
  readonly logoSrc = input('/images/home/VNSC.jfif');
  readonly logoAlt = input('Logo VNSC');
  readonly title = input('VN Biodiversity WebGIS');
  readonly message = input('Đang tải dữ liệu');
  readonly minDurationMs = input(650);

  protected readonly isVisible = signal(true);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (!this.isBrowser) {
      this.isVisible.set(false);
      return;
    }

    this.scheduleHide();

    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.show();
        return;
      }

      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.scheduleHide();
      }
    });

    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.clearHideTimer();
    });
  }

  private show(): void {
    this.clearHideTimer();
    this.isVisible.set(true);
  }

  private scheduleHide(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => this.isVisible.set(false), this.minDurationMs());
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}

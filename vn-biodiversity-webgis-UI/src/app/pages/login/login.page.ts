import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  submit() {
    if (this.isSubmitting()) {
      return;
    }

    const email = this.email.trim();
    if (!email || !this.password) {
      this.errorMessage.set('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.auth
      .login(email, this.password)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const canOpenRequestedUrl = Boolean(
            requestedUrl &&
            requestedUrl.startsWith('/') &&
            !requestedUrl.startsWith('//') &&
            (!requestedUrl.startsWith('/admin') || this.auth.hasRole(['administrator'])) &&
            (!requestedUrl.startsWith('/editor') || this.auth.hasRole(['editor-staff'])),
          );
          const returnUrl = canOpenRequestedUrl && requestedUrl ? requestedUrl : this.defaultRoute();
          this.router.navigateByUrl(returnUrl);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.loginErrorMessage(error));
        },
      });
  }

  private loginErrorMessage(error: unknown) {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Không thể đăng nhập. Vui lòng thử lại.';
    }
    if (error.status === 401) {
      return 'Email hoặc mật khẩu không đúng.';
    }
    if (error.status === 0) {
      return 'Không thể kết nối đến máy chủ.';
    }
    return 'Máy chủ không thể xử lý yêu cầu đăng nhập.';
  }

  private defaultRoute() {
    if (this.auth.hasRole(['administrator'])) return '/admin';
    if (this.auth.hasRole(['editor-staff'])) return '/editor';
    return '/';
  }
}

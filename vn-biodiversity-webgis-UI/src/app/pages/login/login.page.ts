import { Component, inject } from '@angular/core';
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
  isSubmitting = false;
  errorMessage = '';

  submit() {
    if (this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth
      .login(this.email, this.password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          const canOpenRequestedUrl = Boolean(
            requestedUrl &&
            requestedUrl.startsWith('/') &&
            !requestedUrl.startsWith('//') &&
            (!requestedUrl.startsWith('/admin') || this.auth.hasRole(['administrator'])),
          );
          const returnUrl = canOpenRequestedUrl && requestedUrl ? requestedUrl : this.defaultRoute();
          this.router.navigateByUrl(returnUrl);
        },
        error: () => {
          this.errorMessage = 'Email hoặc mật khẩu không đúng.';
        },
      });
  }

  private defaultRoute() {
    return this.auth.hasRole(['administrator']) ? '/admin' : '/';
  }
}

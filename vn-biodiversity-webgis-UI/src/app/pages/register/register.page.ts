import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import type { RegisterRequest } from '../../data-access/models/auth/auth.model';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: './register.page.css',
})
export class RegisterPage {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  form: RegisterRequest = {
    displayName: '',
    email: '',
    birthDate: '',
    gender: 'male',
    phone: '',
    password: '',
    confirmPassword: '',
  };
  isSubmitting = false;
  errorMessage = '';

  submit() {
    if (this.isSubmitting) return;
    if (this.form.password !== this.form.confirmPassword) {
      this.errorMessage = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.auth.register(this.form).pipe(finalize(() => (this.isSubmitting = false))).subscribe({
      next: () => this.router.navigateByUrl('/account'),
      error: (error: HttpErrorResponse) => {
        this.errorMessage = typeof error.error?.message === 'string' ? error.error.message : 'Chưa thể đăng ký tài khoản.';
      },
    });
  }
}

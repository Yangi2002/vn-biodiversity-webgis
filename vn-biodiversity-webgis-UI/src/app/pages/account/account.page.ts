import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import type { UpdateProfileRequest } from '../../data-access/models/auth/auth.model';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { AdminNavbarComponent } from '../admin/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-account-page',
  imports: [FormsModule, AdminNavbarComponent, SiteHeaderComponent],
  templateUrl: './account.page.html',
  styleUrl: './account.page.css',
})
export class AccountPage {
  protected readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  protected user = this.auth.currentUser();
  protected readonly isAdministrator = this.auth.hasRole(['administrator']);
  protected form: UpdateProfileRequest = {
    displayName: this.user?.displayName ?? '',
    email: this.user?.email ?? '',
    birthDate: this.user?.birthDate ?? '',
    gender: this.user?.gender ?? '',
    phone: this.user?.phone ?? '',
    password: '',
    confirmPassword: '',
  };
  protected isSubmitting = false;
  protected message = '';
  protected isError = false;

  protected save() {
    if (this.form.password !== this.form.confirmPassword) {
      this.isError = true;
      this.message = 'Mật khẩu xác nhận không khớp.';
      return;
    }

    this.isSubmitting = true;
    this.message = '';
    this.auth.updateProfile(this.form).pipe(finalize(() => (this.isSubmitting = false))).subscribe({
      next: (user) => {
        this.user = user;
        this.form.password = '';
        this.form.confirmPassword = '';
        this.isError = false;
        this.message = 'Đã cập nhật thông tin tài khoản.';
      },
      error: (error: HttpErrorResponse) => {
        this.isError = true;
        this.message = typeof error.error?.message === 'string' ? error.error.message : 'Chưa thể cập nhật tài khoản.';
      },
    });
  }

  protected logout() {
    this.auth.logoutFromServer().subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: () => {
        this.auth.logout();
        this.router.navigateByUrl('/');
      },
    });
  }
}

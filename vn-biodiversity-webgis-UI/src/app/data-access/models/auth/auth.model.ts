export interface AdminUser {
  userId: string;
  email: string;
  displayName: string | null;
  roles: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: AdminUser;
}

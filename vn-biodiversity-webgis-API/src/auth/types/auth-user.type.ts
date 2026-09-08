export interface AuthUser {
  userId: string;
  email: string;
  displayName: string | null;
  roles: string[];
  permissions: string[];
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  exp: number;
}

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string | null;
  roles: string[];
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  exp: number;
}

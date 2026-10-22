import type { GovernanceRole } from './auth/auth.model';

export interface ManagedUser {
  userId: string;
  email: string;
  displayName: string | null;
  birthDate: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  isActive: boolean;
  roles: GovernanceRole[];
  createdAt: string;
  updatedAt: string;
}

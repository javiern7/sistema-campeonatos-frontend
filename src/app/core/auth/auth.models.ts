import { QueryParams } from '../api/api.models';
import type { AuthorizationAction, AuthorizationResource } from './authorization.service';

export type AppRole = 'AUTHENTICATED' | 'SUPER_ADMIN' | 'TOURNAMENT_ADMIN';
export type AppPermission = `${AuthorizationResource}:${AuthorizationAction}`;
export type AuthorizationSource = 'backend-session' | 'temporary-profile';

export interface BackendAuthSession {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  roles: AppRole[];
  permissions: AppPermission[];
}

export interface AuthSession {
  userId?: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  basicToken: string;
  roles: AppRole[];
  permissions: AppPermission[];
  authorizationSource: AuthorizationSource;
  validatedAt: string;
}

export interface AuthorizationProfile {
  usernames: string[];
  roles: AppRole[];
}

export interface AuthContractConfig {
  sessionPath: string;
  allowTemporaryProfileFallback: boolean;
  fallbackValidationPath: string;
  fallbackValidationQuery?: QueryParams;
  defaultRoles: AppRole[];
  roleProfiles: AuthorizationProfile[];
}

import { QueryParams } from '../api/api.models';

export type AppRole = 'AUTHENTICATED' | 'SUPER_ADMIN' | 'TOURNAMENT_ADMIN';
export type AuthorizationSource = 'temporary-profile';

export interface AuthSession {
  username: string;
  basicToken: string;
  roles: AppRole[];
  authorizationSource: AuthorizationSource;
  validatedAt: string;
}

export interface AuthorizationProfile {
  usernames: string[];
  roles: AppRole[];
}

export interface AuthContractConfig {
  validationPath: string;
  validationQuery?: QueryParams;
  defaultRoles: AppRole[];
  roleProfiles: AuthorizationProfile[];
  authorizationSource: AuthorizationSource;
}

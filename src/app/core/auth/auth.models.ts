export type AppRole = 'AUTHENTICATED' | 'SUPER_ADMIN' | 'TOURNAMENT_ADMIN' | 'OPERATOR' | string;
export type AppPermission = string;

export interface AuthTokenResponse {
  tokenType: string;
  authenticationScheme: string;
  sessionId: number | null;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
}

export interface BackendAuthSession {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  authenticationScheme: string;
  sessionStrategy: string;
  sessionId: number | null;
  accessTokenExpiresAt: string | null;
  roles: AppRole[];
  permissions: AppPermission[];
}

export interface AuthSession extends BackendAuthSession {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string | null;
  validatedAt: string;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthRefreshRequest {
  refreshToken: string;
}

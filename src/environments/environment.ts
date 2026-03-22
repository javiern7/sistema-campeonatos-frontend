import { AuthContractConfig } from '../app/core/auth/auth.models';

const authContract: AuthContractConfig = {
  sessionPath: '/auth/session',
  allowTemporaryProfileFallback: true,
  fallbackValidationPath: '/sports',
  fallbackValidationQuery: { activeOnly: true },
  defaultRoles: ['AUTHENTICATED'],
  roleProfiles: [{ usernames: ['devadmin'], roles: ['SUPER_ADMIN'] }]
};

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  appName: 'Championships MVP',
  authContract
};

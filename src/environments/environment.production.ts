import { AuthContractConfig } from '../app/core/auth/auth.models';

const authContract: AuthContractConfig = {
  sessionPath: '/auth/session',
  allowTemporaryProfileFallback: true,
  fallbackValidationPath: '/sports',
  fallbackValidationQuery: { activeOnly: true },
  defaultRoles: ['AUTHENTICATED'],
  roleProfiles: []
};

export const environment = {
  production: true,
  apiBaseUrl: '/api',
  appName: 'Championships MVP',
  authContract
};

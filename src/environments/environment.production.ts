import { AuthContractConfig } from '../app/core/auth/auth.models';

const authContract: AuthContractConfig = {
  validationPath: '/sports',
  validationQuery: { activeOnly: true },
  defaultRoles: ['AUTHENTICATED'],
  roleProfiles: [],
  authorizationSource: 'temporary-profile'
};

export const environment = {
  production: true,
  apiBaseUrl: '/api',
  appName: 'Championships MVP',
  authContract
};

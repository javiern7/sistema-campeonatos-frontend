import { AuthContractConfig } from '../app/core/auth/auth.models';

const authContract: AuthContractConfig = {
  validationPath: '/sports',
  validationQuery: { activeOnly: true },
  defaultRoles: ['AUTHENTICATED'],
  roleProfiles: [{ usernames: ['devadmin'], roles: ['SUPER_ADMIN'] }],
  authorizationSource: 'temporary-profile'
};

export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api',
  appName: 'Championships MVP',
  authContract
};

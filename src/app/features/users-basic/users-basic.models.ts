import { PageResponse, QueryParams } from '../../core/api/api.models';

export type OperationalUserStatus = string;
export type OperationalRoleCode = string;
export const OPERATIONAL_USERS_DEFAULT_SORT = 'fullName,asc';

export interface OperationalUserRole {
  roleCode: OperationalRoleCode;
  roleName: string;
  description?: string | null;
  mutable?: boolean;
  assignable?: boolean;
  manageabilityReason?: string | null;
}

export type OperationalUserRoleValue = OperationalRoleCode | OperationalUserRole;

export interface OperationalUser {
  userId: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: OperationalUserStatus;
  lastLoginAt: string | null;
  roles: OperationalUserRoleValue[];
  statusManageable: boolean;
  statusManageabilityReason?: string | null;
}

export interface OperationalUserDetail extends OperationalUser {
  roles: OperationalUserRole[];
  rolesManageable: boolean;
  rolesManageabilityReason: string | null;
}

export interface OperationalUsersFilters extends QueryParams {
  query?: string;
  status?: OperationalUserStatus | '';
  roleCode?: OperationalRoleCode | '';
  page?: number;
  size?: number;
  sort?: string;
}

export type OperationalUsersPage = PageResponse<OperationalUser>;

export interface UserStatusUpdateRequest {
  status: OperationalUserStatus;
  reason: string;
}

export interface OperationalRoleCatalogItem {
  roleCode: OperationalRoleCode;
  roleName: string;
  description: string | null;
  mutable: boolean;
  assignable: boolean;
  manageabilityReason: string | null;
}

export interface OperationalUserStatusCatalogItem {
  code: OperationalUserStatus;
  name: string;
  description: string | null;
}

export interface OperationalPermission {
  code: string;
  name: string;
  description: string | null;
}

export interface OperationalUserPermissionSummary {
  userId: number;
  username: string;
  roles: OperationalUserRole[];
  permissions: OperationalPermission[];
}

export interface UserRolesUpdateRequest {
  roleCodes: OperationalRoleCode[];
  reason: string;
}

export interface BasicConfiguration {
  organizationName: string;
  supportEmail: string;
  defaultTimezone: string;
  updatedAt: string;
}

export interface BasicConfigurationUpdateRequest {
  organizationName: string;
  supportEmail: string;
  defaultTimezone: string;
}

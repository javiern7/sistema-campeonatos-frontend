import { PageResponse, QueryParams } from '../../core/api/api.models';

export type OperationalUserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type OperationalRoleCode = 'SUPER_ADMIN' | 'TOURNAMENT_ADMIN' | 'OPERATOR' | string;

export interface OperationalUserRole {
  roleCode: OperationalRoleCode;
  roleName: string;
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

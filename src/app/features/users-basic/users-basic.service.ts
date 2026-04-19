import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  BasicConfiguration,
  BasicConfigurationUpdateRequest,
  OperationalRoleCatalogItem,
  OperationalUser,
  OperationalUserDetail,
  OperationalUserPermissionSummary,
  OperationalUserStatusCatalogItem,
  OperationalUsersFilters,
  OperationalUsersPage,
  UserRolesUpdateRequest,
  UserStatusUpdateRequest
} from './users-basic.models';

@Injectable({ providedIn: 'root' })
export class UsersBasicService {
  private readonly api = inject(ApiClientService);

  listUsers(filters: OperationalUsersFilters): Observable<OperationalUsersPage> {
    return this.api.get<OperationalUsersPage>('/operations/users', filters);
  }

  getUserDetail(userId: number): Observable<OperationalUserDetail> {
    return this.api.get<OperationalUserDetail>(`/operations/users/${userId}`);
  }

  getUserPermissions(userId: number): Observable<OperationalUserPermissionSummary> {
    return this.api.get<OperationalUserPermissionSummary>(`/operations/users/${userId}/permissions`);
  }

  updateUserStatus(userId: number, request: UserStatusUpdateRequest): Observable<OperationalUser> {
    return this.api.put<OperationalUser, UserStatusUpdateRequest>(`/operations/users/${userId}/status`, request);
  }

  updateUserRoles(userId: number, request: UserRolesUpdateRequest): Observable<OperationalUserDetail> {
    return this.api.put<OperationalUserDetail, UserRolesUpdateRequest>(`/operations/users/${userId}/roles`, request);
  }

  listRoles(): Observable<OperationalRoleCatalogItem[]> {
    return this.api.get<OperationalRoleCatalogItem[]>('/operations/roles');
  }

  listUserStatuses(): Observable<OperationalUserStatusCatalogItem[]> {
    return this.api.get<OperationalUserStatusCatalogItem[]>('/operations/user-statuses');
  }

  getBasicConfiguration(): Observable<BasicConfiguration> {
    return this.api.get<BasicConfiguration>('/operations/basic-configuration');
  }

  updateBasicConfiguration(request: BasicConfigurationUpdateRequest): Observable<BasicConfiguration> {
    return this.api.put<BasicConfiguration, BasicConfigurationUpdateRequest>('/operations/basic-configuration', request);
  }
}

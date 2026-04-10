import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../core/api/api-client.service';
import {
  BasicConfiguration,
  BasicConfigurationUpdateRequest,
  OperationalUser,
  OperationalUsersFilters,
  OperationalUsersPage,
  UserStatusUpdateRequest
} from './users-basic.models';

@Injectable({ providedIn: 'root' })
export class UsersBasicService {
  private readonly api = inject(ApiClientService);

  listUsers(filters: OperationalUsersFilters): Observable<OperationalUsersPage> {
    return this.api.get<OperationalUsersPage>('/operations/users', filters);
  }

  updateUserStatus(userId: number, request: UserStatusUpdateRequest): Observable<OperationalUser> {
    return this.api.put<OperationalUser, UserStatusUpdateRequest>(`/operations/users/${userId}/status`, request);
  }

  getBasicConfiguration(): Observable<BasicConfiguration> {
    return this.api.get<BasicConfiguration>('/operations/basic-configuration');
  }

  updateBasicConfiguration(request: BasicConfigurationUpdateRequest): Observable<BasicConfiguration> {
    return this.api.put<BasicConfiguration, BasicConfigurationUpdateRequest>('/operations/basic-configuration', request);
  }
}

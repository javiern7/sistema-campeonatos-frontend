import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppError } from '../error/app-error.model';
import { ApiResponse, QueryParamValue } from './api.models';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string, query?: object): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.buildUrl(path), { params: this.buildParams(query) })
      .pipe(map((response) => this.unwrap(response)));
  }

  post<TResponse, TRequest>(path: string, body: TRequest): Observable<TResponse> {
    return this.http
      .post<ApiResponse<TResponse>>(this.buildUrl(path), body)
      .pipe(map((response) => this.unwrap(response)));
  }

  put<TResponse, TRequest>(path: string, body: TRequest): Observable<TResponse> {
    return this.http
      .put<ApiResponse<TResponse>>(this.buildUrl(path), body)
      .pipe(map((response) => this.unwrap(response)));
  }

  delete(path: string): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(this.buildUrl(path))
      .pipe(map((response) => this.unwrap(response)));
  }

  buildParams(query?: object): HttpParams {
    let params = new HttpParams();

    if (!query) {
      return params;
    }

    for (const [key, value] of Object.entries(query as Record<string, QueryParamValue>)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      params = params.set(key, String(value));
    }

    return params;
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new AppError(400, response.message, response.code, response.errors);
    }

    return response.data;
  }
}

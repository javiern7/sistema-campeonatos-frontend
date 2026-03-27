import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';

import { PageResponse } from '../api/api.models';

@Injectable({ providedIn: 'root' })
export class CatalogLoaderService {
  loadAll<T>(
    fetchPage: (page: number, size: number) => Observable<PageResponse<T>>,
    size = 100
  ): Observable<T[]> {
    return fetchPage(0, size).pipe(
      expand((pageResponse) => {
        const currentPage = pageResponse.page ?? pageResponse.number ?? 0;
        return currentPage + 1 < pageResponse.totalPages ? fetchPage(currentPage + 1, size) : EMPTY;
      }),
      reduce((items, pageResponse) => [...items, ...pageResponse.content], [] as T[])
    );
  }
}

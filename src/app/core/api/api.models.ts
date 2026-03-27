export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  errors?: unknown;
  timestamp: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  number?: number;
  totalElements: number;
  totalPages: number;
  size: number;
  first?: boolean;
  last?: boolean;
}

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue>;

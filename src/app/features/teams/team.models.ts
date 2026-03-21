import { PageResponse } from '../../core/api/api.models';

export interface Team {
  id: number;
  name: string;
  shortName: string | null;
  code: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamFormValue {
  name: string;
  shortName: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
  active: boolean;
}

export interface TeamFilters {
  name?: string;
  code?: string;
  active?: boolean | '';
  page?: number;
  size?: number;
}

export type TeamPage = PageResponse<Team>;

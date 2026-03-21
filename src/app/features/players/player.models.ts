import { PageResponse } from '../../core/api/api.models';

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerFormValue {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  email: string;
  phone: string;
  active: boolean;
}

export interface PlayerFilters {
  search?: string;
  documentType?: string;
  documentNumber?: string;
  active?: boolean | '';
  page?: number;
  size?: number;
}

export type PlayerPage = PageResponse<Player>;

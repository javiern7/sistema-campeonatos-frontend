import { PageResponse } from '../../core/api/api.models';

export interface StageGroup {
  id: number;
  stageId: number;
  code: string;
  name: string;
  sequenceOrder: number;
  createdAt: string;
}

export interface StageGroupFilters {
  stageId?: number | '';
  code?: string;
  page?: number;
  size?: number;
}

export interface StageGroupFormValue {
  stageId: number;
  code: string;
  name: string;
  sequenceOrder: number;
}

export type StageGroupPage = PageResponse<StageGroup>;

export type FinancialMovementType = 'INCOME' | 'EXPENSE';

export type FinancialMovementCategory =
  | 'INSCRIPCION_EQUIPO'
  | 'APORTE_SIMPLE'
  | 'PATROCINIO_SIMPLE'
  | 'OTRO_INGRESO_OPERATIVO'
  | 'ARBITRAJE'
  | 'CANCHA'
  | 'LOGISTICA'
  | 'PREMIOS'
  | 'OTRO_GASTO_OPERATIVO';

export interface FinancialTeam {
  tournamentTeamId: number;
  teamId: number;
  name: string;
  shortName: string | null;
  code: string | null;
}

export interface FinancialMovement {
  movementId: number;
  tournamentId: number;
  team: FinancialTeam | null;
  movementType: FinancialMovementType;
  category: FinancialMovementCategory;
  amount: number;
  occurredOn: string;
  description: string | null;
  referenceCode: string | null;
  createdAt: string;
}

export interface FinancialMovementListResponse {
  tournamentId: number;
  totalMovements: number;
  movements: FinancialMovement[];
}

export interface FinancialCategorySummary {
  movementType: FinancialMovementType;
  category: FinancialMovementCategory;
  totalAmount: number;
  movementCount: number;
}

export interface FinancialTeamSummary {
  team: FinancialTeam;
  incomeTotal: number;
  movementCount: number;
}

export interface FinancialTraceability {
  movementSource: string;
  tournamentSource: string;
  teamSource: string;
  accountingScope: string;
}

export interface BasicFinancialSummary {
  tournamentId: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  movementCount: number;
  byCategory: FinancialCategorySummary[];
  incomeByTeam: FinancialTeamSummary[];
  traceability: FinancialTraceability;
}

export interface FinancialMovementFilters {
  movementType?: FinancialMovementType | '';
  category?: FinancialMovementCategory | '';
  tournamentTeamId?: number | '';
}

export interface FinancialMovementCreatePayload {
  tournamentTeamId: number | null;
  movementType: FinancialMovementType;
  category: FinancialMovementCategory;
  amount: number;
  occurredOn: string;
  description: string | null;
  referenceCode: string | null;
}

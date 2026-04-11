export interface Sport {
  id: number;
  code: string;
  name: string;
  teamBased: boolean;
  maxPlayersOnField: number | null;
  scoreLabel: string | null;
  active: boolean;
}

export interface SportFormValue {
  code: string;
  name: string;
  teamBased: boolean;
  maxPlayersOnField: number | null;
  scoreLabel: string;
  active: boolean;
}

export interface SportPosition {
  id: number;
  sportId: number;
  code: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface SportPositionFormValue {
  code: string;
  name: string;
  displayOrder: number;
  active: boolean;
}

export interface CompetitionFormat {
  code: string;
  name: string;
  description: string;
}

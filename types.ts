
export type BreathingMode = 'POWER_BREATH' | 'BOX' | 'FOUR_SEVEN_EIGHT' | 'NONE';

export interface PowerBreathConfig {
  breathsPerRound: number;
  totalRounds: number;
  breathPace: number; // seconds per breath cycle
}

export interface BoxConfig {
  inhale: number;
  holdIn: number;
  exhale: number;
  holdOut: number;
}

export interface SessionResult {
  id: string;
  date: number;
  mode: BreathingMode;
  rounds: number;
  holdTimes: number[]; // For retention cycles
  avgHoldTime?: number;
  maxHoldTime?: number;
  totalDuration: number;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  date: number;
  content: string;
}

export interface AppGoals {
  breathHoldSeconds: number;
}

export type Phase = 'PREPARE' | 'INHALE' | 'HOLD_IN' | 'EXHALE' | 'HOLD_OUT' | 'RECOVER' | 'REST' | 'COMPLETED';

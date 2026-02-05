
import { PowerBreathConfig, BoxConfig } from './types';

export const DEFAULT_POWER_CONFIG: PowerBreathConfig = {
  breathsPerRound: 30,
  totalRounds: 3,
  // Increased from 1.8 to 3.15 (1.8 * 1.75)
  breathPace: 3.15,
};

export const DEFAULT_BOX_CONFIG: BoxConfig = {
  // Increased from 4 to 7 (4 * 1.75)
  inhale: 7,
  holdIn: 7,
  exhale: 7,
  holdOut: 7,
};

export const FOUR_SEVEN_EIGHT_CONFIG: BoxConfig = {
  inhale: 4,
  holdIn: 7,
  exhale: 8,
  holdOut: 0,
};

export const RECOVERY_HOLD_TIME = 15; // 15 seconds recovery hold for power breathing cycle

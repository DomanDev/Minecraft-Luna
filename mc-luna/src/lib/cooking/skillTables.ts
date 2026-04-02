// src/lib/cooking/skillTables.ts

export const PREPARATION_MASTER_TIME_REDUCTION: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 12,
  12: 13,
  13: 15,
  14: 16,
  15: 18,
  16: 19,
  17: 21,
  18: 22,
  19: 24,
  20: 25,
  21: 28,
  22: 30,
  23: 33,
  24: 35,
  25: 38,
  26: 40,
  27: 43,
  28: 45,
  29: 48,
  30: 50,
};

export const BALANCE_OF_TASTE_DURATION_BONUS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 12,
  12: 14,
  13: 16,
  14: 18,
  15: 20,
  16: 22,
  17: 24,
  18: 26,
  19: 28,
  20: 30,
  21: 34,
  22: 38,
  23: 42,
  24: 46,
  25: 50,
  26: 54,
  27: 58,
  28: 62,
  29: 66,
  30: 70,
};

export const GOURMET_SPECIAL_CHANCE: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 14,
  14: 16,
  15: 18,
  16: 20,
  17: 22,
  18: 24,
  19: 26,
  20: 28,
  21: 31,
  22: 34,
  23: 37,
  24: 40,
  25: 43,
  26: 46,
  27: 49,
  28: 52,
  29: 56,
  30: 60,
};

export const INSTANT_COMPLETION_TABLE: Record<
  number,
  { chancePercent: number; durationSeconds: number; cooldownSeconds: number; manaCost: number }
> = {
  0: { chancePercent: 0, durationSeconds: 0, cooldownSeconds: 0, manaCost: 0 },
  1: { chancePercent: 3, durationSeconds: 10, cooldownSeconds: 240, manaCost: 30 },
  2: { chancePercent: 4, durationSeconds: 11, cooldownSeconds: 240, manaCost: 30 },
  3: { chancePercent: 5, durationSeconds: 12, cooldownSeconds: 240, manaCost: 31 },
  4: { chancePercent: 6, durationSeconds: 13, cooldownSeconds: 240, manaCost: 31 },
  5: { chancePercent: 7, durationSeconds: 14, cooldownSeconds: 240, manaCost: 32 },
  6: { chancePercent: 8, durationSeconds: 15, cooldownSeconds: 240, manaCost: 32 },
  7: { chancePercent: 9, durationSeconds: 16, cooldownSeconds: 240, manaCost: 33 },
  8: { chancePercent: 10, durationSeconds: 17, cooldownSeconds: 240, manaCost: 34 },
  9: { chancePercent: 11, durationSeconds: 18, cooldownSeconds: 240, manaCost: 35 },
  10: { chancePercent: 12, durationSeconds: 20, cooldownSeconds: 240, manaCost: 36 },
  11: { chancePercent: 14, durationSeconds: 22, cooldownSeconds: 240, manaCost: 37 },
  12: { chancePercent: 16, durationSeconds: 24, cooldownSeconds: 240, manaCost: 38 },
  13: { chancePercent: 18, durationSeconds: 26, cooldownSeconds: 240, manaCost: 39 },
  14: { chancePercent: 20, durationSeconds: 28, cooldownSeconds: 240, manaCost: 40 },
  15: { chancePercent: 22, durationSeconds: 30, cooldownSeconds: 240, manaCost: 41 },
  16: { chancePercent: 24, durationSeconds: 32, cooldownSeconds: 240, manaCost: 42 },
  17: { chancePercent: 26, durationSeconds: 34, cooldownSeconds: 240, manaCost: 43 },
  18: { chancePercent: 28, durationSeconds: 36, cooldownSeconds: 240, manaCost: 44 },
  19: { chancePercent: 30, durationSeconds: 38, cooldownSeconds: 240, manaCost: 45 },
  20: { chancePercent: 31, durationSeconds: 40, cooldownSeconds: 240, manaCost: 47 },
  21: { chancePercent: 32, durationSeconds: 42, cooldownSeconds: 240, manaCost: 50 },
  22: { chancePercent: 33, durationSeconds: 44, cooldownSeconds: 240, manaCost: 53 },
  23: { chancePercent: 34, durationSeconds: 46, cooldownSeconds: 240, manaCost: 56 },
  24: { chancePercent: 35, durationSeconds: 48, cooldownSeconds: 240, manaCost: 58 },
  25: { chancePercent: 36, durationSeconds: 50, cooldownSeconds: 240, manaCost: 60 },
  26: { chancePercent: 37, durationSeconds: 52, cooldownSeconds: 240, manaCost: 62 },
  27: { chancePercent: 38, durationSeconds: 54, cooldownSeconds: 240, manaCost: 64 },
  28: { chancePercent: 39, durationSeconds: 56, cooldownSeconds: 240, manaCost: 66 },
  29: { chancePercent: 39, durationSeconds: 58, cooldownSeconds: 240, manaCost: 68 },
  30: { chancePercent: 40, durationSeconds: 60, cooldownSeconds: 240, manaCost: 70 },
};

export const BANQUET_PREPARATION_TABLE: Record<
  number,
  {
    chancePercent: number;
    extraCount: number;
    durationSeconds: number;
    cooldownSeconds: number;
    manaCost: number;
  }
> = {
  0: { chancePercent: 0, extraCount: 0, durationSeconds: 0, cooldownSeconds: 0, manaCost: 0 },
  1: { chancePercent: 8, extraCount: 1, durationSeconds: 40, cooldownSeconds: 600, manaCost: 30 },
  2: { chancePercent: 10, extraCount: 1, durationSeconds: 48, cooldownSeconds: 600, manaCost: 30 },
  3: { chancePercent: 12, extraCount: 1, durationSeconds: 56, cooldownSeconds: 600, manaCost: 31 },
  4: { chancePercent: 14, extraCount: 1, durationSeconds: 64, cooldownSeconds: 600, manaCost: 31 },
  5: { chancePercent: 16, extraCount: 1, durationSeconds: 72, cooldownSeconds: 600, manaCost: 32 },
  6: { chancePercent: 18, extraCount: 1, durationSeconds: 80, cooldownSeconds: 600, manaCost: 32 },
  7: { chancePercent: 20, extraCount: 1, durationSeconds: 88, cooldownSeconds: 600, manaCost: 33 },
  8: { chancePercent: 22, extraCount: 1, durationSeconds: 96, cooldownSeconds: 600, manaCost: 34 },
  9: { chancePercent: 24, extraCount: 1, durationSeconds: 104, cooldownSeconds: 600, manaCost: 35 },
  10: { chancePercent: 26, extraCount: 1, durationSeconds: 112, cooldownSeconds: 600, manaCost: 36 },
  11: { chancePercent: 28, extraCount: 2, durationSeconds: 120, cooldownSeconds: 600, manaCost: 37 },
  12: { chancePercent: 30, extraCount: 2, durationSeconds: 128, cooldownSeconds: 600, manaCost: 38 },
  13: { chancePercent: 32, extraCount: 2, durationSeconds: 136, cooldownSeconds: 600, manaCost: 39 },
  14: { chancePercent: 34, extraCount: 2, durationSeconds: 144, cooldownSeconds: 600, manaCost: 40 },
  15: { chancePercent: 36, extraCount: 2, durationSeconds: 152, cooldownSeconds: 600, manaCost: 41 },
  16: { chancePercent: 38, extraCount: 2, durationSeconds: 160, cooldownSeconds: 600, manaCost: 42 },
  17: { chancePercent: 40, extraCount: 2, durationSeconds: 168, cooldownSeconds: 600, manaCost: 43 },
  18: { chancePercent: 42, extraCount: 3, durationSeconds: 176, cooldownSeconds: 600, manaCost: 44 },
  19: { chancePercent: 44, extraCount: 3, durationSeconds: 184, cooldownSeconds: 600, manaCost: 45 },
  20: { chancePercent: 46, extraCount: 3, durationSeconds: 192, cooldownSeconds: 600, manaCost: 47 },
  21: { chancePercent: 48, extraCount: 3, durationSeconds: 200, cooldownSeconds: 600, manaCost: 50 },
  22: { chancePercent: 50, extraCount: 3, durationSeconds: 210, cooldownSeconds: 600, manaCost: 53 },
  23: { chancePercent: 52, extraCount: 3, durationSeconds: 220, cooldownSeconds: 600, manaCost: 56 },
  24: { chancePercent: 54, extraCount: 4, durationSeconds: 230, cooldownSeconds: 600, manaCost: 58 },
  25: { chancePercent: 56, extraCount: 4, durationSeconds: 240, cooldownSeconds: 600, manaCost: 60 },
  26: { chancePercent: 58, extraCount: 4, durationSeconds: 250, cooldownSeconds: 600, manaCost: 62 },
  27: { chancePercent: 60, extraCount: 4, durationSeconds: 260, cooldownSeconds: 600, manaCost: 64 },
  28: { chancePercent: 62, extraCount: 5, durationSeconds: 270, cooldownSeconds: 600, manaCost: 66 },
  29: { chancePercent: 64, extraCount: 5, durationSeconds: 275, cooldownSeconds: 600, manaCost: 68 },
  30: { chancePercent: 70, extraCount: 5, durationSeconds: 300, cooldownSeconds: 600, manaCost: 70 },
};

/**
 * -------------------------
 * 아래 3개는 루나위키에 정량식이 공개되지 않아
 * 서버 실측값으로 나중에 쉽게 바꾸기 위해 상수 분리
 * -------------------------
 */

/** 손재주 1당 일품 확률 가산(임시값) */
export const DEXTERITY_SPECIAL_CHANCE_PER_POINT = 0.2;

/** 손재주 1당 요리 시간 감소율(임시값) */
export const DEXTERITY_TIME_REDUCTION_PER_POINT = 0.15;

/** 노련함 성공률 계산용 기본값 / 1포인트당 증가량(임시값) */
export const COOKING_SUCCESS_RATE_BASE = 90;
export const COOKING_SUCCESS_RATE_PER_MASTERY = 0.2;
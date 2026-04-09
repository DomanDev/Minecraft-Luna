// src/lib/fishing/skillTables.ts

import type {
  BaitEffect,
  BaitType,
  GroundbaitEffect,
  GroundbaitType,
} from "./types";

/**
 * 소문난 미끼 / 낚싯줄 장력 수치표
 * 루나위키 기준
 */
export const RUMORED_BAIT_TABLE: Record<number, number> = {
  0: 0,
  1: 0.7,
  2: 1.4,
  3: 2.1,
  4: 2.8,
  5: 3.5,
  6: 4.2,
  7: 4.9,
  8: 5.6,
  9: 6.3,
  10: 7.0,
  11: 8.1,
  12: 9.2,
  13: 10.3,
  14: 11.4,
  15: 12.5,
  16: 13.6,
  17: 14.7,
  18: 15.8,
  19: 16.9,
  20: 18.0,
  21: 24.0,
  22: 27.5,
  23: 31.0,
  24: 34.5,
  25: 38.0,
  26: 41.5,
  27: 45.0,
  28: 48.5,
  29: 52.0,
  30: 55.0,
};

export const LINE_TENSION_TABLE: Record<number, number> = {
  0: 0,
  1: 0.7,
  2: 1.4,
  3: 2.1,
  4: 2.8,
  5: 3.5,
  6: 4.2,
  7: 4.9,
  8: 5.6,
  9: 6.3,
  10: 7.0,
  11: 8.1,
  12: 9.2,
  13: 10.3,
  14: 11.4,
  15: 12.5,
  16: 13.6,
  17: 14.7,
  18: 15.8,
  19: 16.9,
  20: 18.0,
  21: 23.0,
  22: 26.0,
  23: 29.0,
  24: 32.0,
  25: 35.0,
  26: 38.0,
  27: 41.0,
  28: 44.0,
  29: 47.0,
  30: 50.0,
};

/**
 * 쌍걸이
 * extraCatchChancePercent = 추가 낚시 기대 확률
 */
export const DOUBLE_HOOK_TABLE: Record<
  number,
  {
    extraCatchChancePercent: number;
    durationSeconds: number;
    cooldownSeconds: number;
    manaCost: number;
  }
> = {
  0: { extraCatchChancePercent: 0, durationSeconds: 0, cooldownSeconds: 0, manaCost: 0 },
  1: { extraCatchChancePercent: 2.0, durationSeconds: 40, cooldownSeconds: 600, manaCost: 30 },
  2: { extraCatchChancePercent: 2.8, durationSeconds: 48, cooldownSeconds: 600, manaCost: 30 },
  3: { extraCatchChancePercent: 3.6, durationSeconds: 56, cooldownSeconds: 600, manaCost: 31 },
  4: { extraCatchChancePercent: 4.4, durationSeconds: 64, cooldownSeconds: 600, manaCost: 31 },
  5: { extraCatchChancePercent: 5.2, durationSeconds: 72, cooldownSeconds: 600, manaCost: 32 },
  6: { extraCatchChancePercent: 6.0, durationSeconds: 80, cooldownSeconds: 600, manaCost: 32 },
  7: { extraCatchChancePercent: 6.8, durationSeconds: 88, cooldownSeconds: 600, manaCost: 33 },
  8: { extraCatchChancePercent: 7.6, durationSeconds: 96, cooldownSeconds: 600, manaCost: 34 },
  9: { extraCatchChancePercent: 8.4, durationSeconds: 104, cooldownSeconds: 600, manaCost: 35 },
  10: { extraCatchChancePercent: 9.2, durationSeconds: 112, cooldownSeconds: 600, manaCost: 36 },
  11: { extraCatchChancePercent: 10.5, durationSeconds: 120, cooldownSeconds: 600, manaCost: 37 },
  12: { extraCatchChancePercent: 11.8, durationSeconds: 128, cooldownSeconds: 600, manaCost: 38 },
  13: { extraCatchChancePercent: 13.1, durationSeconds: 136, cooldownSeconds: 600, manaCost: 39 },
  14: { extraCatchChancePercent: 14.4, durationSeconds: 144, cooldownSeconds: 600, manaCost: 40 },
  15: { extraCatchChancePercent: 15.7, durationSeconds: 152, cooldownSeconds: 600, manaCost: 41 },
  16: { extraCatchChancePercent: 17.0, durationSeconds: 160, cooldownSeconds: 600, manaCost: 42 },
  17: { extraCatchChancePercent: 18.3, durationSeconds: 168, cooldownSeconds: 600, manaCost: 43 },
  18: { extraCatchChancePercent: 19.6, durationSeconds: 176, cooldownSeconds: 600, manaCost: 44 },
  19: { extraCatchChancePercent: 20.9, durationSeconds: 184, cooldownSeconds: 600, manaCost: 45 },
  20: { extraCatchChancePercent: 22.2, durationSeconds: 192, cooldownSeconds: 600, manaCost: 47 },
  21: { extraCatchChancePercent: 26.0, durationSeconds: 200, cooldownSeconds: 480, manaCost: 50 },
  22: { extraCatchChancePercent: 29.0, durationSeconds: 208, cooldownSeconds: 480, manaCost: 53 },
  23: { extraCatchChancePercent: 32.0, durationSeconds: 216, cooldownSeconds: 480, manaCost: 56 },
  24: { extraCatchChancePercent: 35.0, durationSeconds: 224, cooldownSeconds: 480, manaCost: 58 },
  25: { extraCatchChancePercent: 38.0, durationSeconds: 232, cooldownSeconds: 480, manaCost: 60 },
  26: { extraCatchChancePercent: 41.0, durationSeconds: 240, cooldownSeconds: 480, manaCost: 62 },
  27: { extraCatchChancePercent: 44.0, durationSeconds: 245, cooldownSeconds: 480, manaCost: 64 },
  28: { extraCatchChancePercent: 47.0, durationSeconds: 250, cooldownSeconds: 480, manaCost: 66 },
  29: { extraCatchChancePercent: 51.0, durationSeconds: 255, cooldownSeconds: 480, manaCost: 68 },
  30: { extraCatchChancePercent: 55.0, durationSeconds: 300, cooldownSeconds: 480, manaCost: 70 },
};

/**
 * 떼낚시
 * nibbleReductionTicks = 기척 고정 감소 틱
 * biteReductionTicks = 입질 고정 감소 틱
 */
export const SCHOOL_FISHING_TABLE: Record<
  number,
  {
    nibbleReductionTicks: number;
    biteReductionTicks: number;
    durationSeconds: number;
    cooldownSeconds: number;
    manaCost: number;
  }
> = {
  0: { nibbleReductionTicks: 0, biteReductionTicks: 0, durationSeconds: 0, cooldownSeconds: 0, manaCost: 0 },
  1: { nibbleReductionTicks: 22, biteReductionTicks: 5, durationSeconds: 40, cooldownSeconds: 600, manaCost: 30 },
  2: { nibbleReductionTicks: 23, biteReductionTicks: 6, durationSeconds: 48, cooldownSeconds: 600, manaCost: 30 },
  3: { nibbleReductionTicks: 25, biteReductionTicks: 7, durationSeconds: 56, cooldownSeconds: 600, manaCost: 31 },
  4: { nibbleReductionTicks: 27, biteReductionTicks: 7, durationSeconds: 64, cooldownSeconds: 600, manaCost: 31 },
  5: { nibbleReductionTicks: 29, biteReductionTicks: 8, durationSeconds: 72, cooldownSeconds: 600, manaCost: 32 },
  6: { nibbleReductionTicks: 31, biteReductionTicks: 8, durationSeconds: 80, cooldownSeconds: 600, manaCost: 32 },
  7: { nibbleReductionTicks: 32, biteReductionTicks: 9, durationSeconds: 88, cooldownSeconds: 600, manaCost: 33 },
  8: { nibbleReductionTicks: 34, biteReductionTicks: 10, durationSeconds: 96, cooldownSeconds: 600, manaCost: 34 },
  9: { nibbleReductionTicks: 35, biteReductionTicks: 11, durationSeconds: 108, cooldownSeconds: 600, manaCost: 35 },
  10: { nibbleReductionTicks: 36, biteReductionTicks: 12, durationSeconds: 120, cooldownSeconds: 600, manaCost: 36 },
  11: { nibbleReductionTicks: 38, biteReductionTicks: 13, durationSeconds: 132, cooldownSeconds: 600, manaCost: 37 },
  12: { nibbleReductionTicks: 41, biteReductionTicks: 14, durationSeconds: 144, cooldownSeconds: 600, manaCost: 38 },
  13: { nibbleReductionTicks: 43, biteReductionTicks: 16, durationSeconds: 156, cooldownSeconds: 600, manaCost: 39 },
  14: { nibbleReductionTicks: 45, biteReductionTicks: 16, durationSeconds: 168, cooldownSeconds: 600, manaCost: 40 },
  15: { nibbleReductionTicks: 47, biteReductionTicks: 17, durationSeconds: 180, cooldownSeconds: 600, manaCost: 41 },
  16: { nibbleReductionTicks: 48, biteReductionTicks: 18, durationSeconds: 188, cooldownSeconds: 600, manaCost: 42 },
  17: { nibbleReductionTicks: 49, biteReductionTicks: 19, durationSeconds: 192, cooldownSeconds: 600, manaCost: 43 },
  18: { nibbleReductionTicks: 49, biteReductionTicks: 20, durationSeconds: 196, cooldownSeconds: 600, manaCost: 44 },
  19: { nibbleReductionTicks: 50, biteReductionTicks: 20, durationSeconds: 198, cooldownSeconds: 600, manaCost: 45 },
  20: { nibbleReductionTicks: 50, biteReductionTicks: 20, durationSeconds: 200, cooldownSeconds: 600, manaCost: 47 },
  21: { nibbleReductionTicks: 53, biteReductionTicks: 22, durationSeconds: 210, cooldownSeconds: 480, manaCost: 50 },
  22: { nibbleReductionTicks: 55, biteReductionTicks: 22, durationSeconds: 220, cooldownSeconds: 480, manaCost: 53 },
  23: { nibbleReductionTicks: 56, biteReductionTicks: 23, durationSeconds: 230, cooldownSeconds: 480, manaCost: 56 },
  24: { nibbleReductionTicks: 58, biteReductionTicks: 24, durationSeconds: 240, cooldownSeconds: 480, manaCost: 58 },
  25: { nibbleReductionTicks: 59, biteReductionTicks: 25, durationSeconds: 248, cooldownSeconds: 480, manaCost: 60 },
  26: { nibbleReductionTicks: 61, biteReductionTicks: 26, durationSeconds: 252, cooldownSeconds: 480, manaCost: 62 },
  27: { nibbleReductionTicks: 61, biteReductionTicks: 26, durationSeconds: 255, cooldownSeconds: 480, manaCost: 64 },
  28: { nibbleReductionTicks: 62, biteReductionTicks: 26, durationSeconds: 258, cooldownSeconds: 480, manaCost: 66 },
  29: { nibbleReductionTicks: 62, biteReductionTicks: 26, durationSeconds: 260, cooldownSeconds: 480, manaCost: 68 },
  30: { nibbleReductionTicks: 72, biteReductionTicks: 30, durationSeconds: 300, cooldownSeconds: 480, manaCost: 70 },
};

/**
 * 미끼 종류별 효과
 * - 기존 시간/등급 보정 유지
 * - 이번 패치로 2회 낚시 확률 보너스 추가
 */
export const BAIT_EFFECTS: Record<BaitType, BaitEffect> = {
  none: {
    nibbleReductionRate: 0,
    biteReductionRate: 0,
    advancedBonus: 0,
    rareBonus: 0,
    doubleCastChanceBonusPercent: 0,
  },
  worm: {
    nibbleReductionRate: 0.05,
    biteReductionRate: 0.03,
    advancedBonus: 20,
    rareBonus: 10,
    doubleCastChanceBonusPercent: 3,
  },
  meal: {
    nibbleReductionRate: 0.1,
    biteReductionRate: 0.05,
    advancedBonus: 30,
    rareBonus: 15,
    doubleCastChanceBonusPercent: 5,
  },
  lure: {
    nibbleReductionRate: 0.15,
    biteReductionRate: 0.1,
    advancedBonus: 40,
    rareBonus: 30,
    doubleCastChanceBonusPercent: 8,
  },
};

/**
 * 떡밥 종류별 시간 감소
 * 새로 추가된 "어장 자원 소모 감소 / 상태 보정"은
 * 현재 시간당 수익 계산에는 반영하지 않고 UI 설명용으로만 사용한다.
 */
export const GROUNDBAIT_EFFECTS: Record<GroundbaitType, GroundbaitEffect> = {
  none: {
    nibbleReductionRate: 0,
    biteReductionRate: 0,
  },
  plain: {
    nibbleReductionRate: 0.02,
    biteReductionRate: 0,
  },
  good: {
    nibbleReductionRate: 0.02,
    biteReductionRate: 0.03,
  },
  rainbow: {
    nibbleReductionRate: 0.05,
    biteReductionRate: 0.05,
  },
};

/** 안전하게 레벨 보정하는 공통 함수 */
export function normalizeSkillLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(30, Math.floor(level)));
}

/** 소문난 미끼 수치 가져오기 */
export function getRumoredBaitValue(level: number): number {
  return RUMORED_BAIT_TABLE[normalizeSkillLevel(level)] ?? 0;
}

/** 낚싯줄 장력 수치 가져오기 */
export function getLineTensionValue(level: number): number {
  return LINE_TENSION_TABLE[normalizeSkillLevel(level)] ?? 0;
}

/** 쌍걸이 테이블 행 가져오기 */
export function getDoubleHookRow(level: number) {
  return DOUBLE_HOOK_TABLE[normalizeSkillLevel(level)];
}

/** 떼낚시 테이블 행 가져오기 */
export function getSchoolFishingRow(level: number) {
  return SCHOOL_FISHING_TABLE[normalizeSkillLevel(level)];
}
// src/lib/farming/exp.ts

export interface FarmingExpResult {
  /** 1사이클당 획득 경험치 */
  expPerCycle: number;
  /** 목표 경험치까지 필요한 사이클 수 */
  cyclesToGoal: number;
  /** 목표 경험치까지 필요한 총 분 */
  totalMinutesToGoal: number;
  /** 목표 경험치까지 필요한 총 시간 */
  totalHoursToGoal: number;
}

/**
 * 농사 경험치 계산
 *
 * 중요:
 * - 경험치는 "작물 개수" 기준이 아님
 * - 경험치는 "수확 판정 횟수" 기준
 * - 작물 2개 드롭은 경험치 추가 없음
 * - 비옥한 토양으로 추가된 재배는 경험치 1회 추가
 */
export function calculateFarmingExp(params: {
  expectedHarvestAttemptsPerCycle: number;
  expPerHarvest: number;
  remainingExp: number;
}): FarmingExpResult {
  const { expectedHarvestAttemptsPerCycle, expPerHarvest, remainingExp } = params;

  const expPerCycle = expectedHarvestAttemptsPerCycle * expPerHarvest;

  const cyclesToGoal =
    expPerCycle > 0 ? Math.ceil(remainingExp / expPerCycle) : Infinity;

  // 현재 기준: 농사 1사이클 = 15분
  const totalMinutesToGoal =
    Number.isFinite(cyclesToGoal) ? cyclesToGoal * 15 : Infinity;

  const totalHoursToGoal =
    Number.isFinite(totalMinutesToGoal) ? totalMinutesToGoal / 60 : Infinity;

  return {
    expPerCycle,
    cyclesToGoal,
    totalMinutesToGoal,
    totalHoursToGoal,
  };
}
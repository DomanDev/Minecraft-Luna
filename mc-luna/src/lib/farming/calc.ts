// src/lib/farming/calc.ts

import type {
  FarmingCalculationInput,
  FarmingCalculationResult,
} from "./types";
import {
  BLESSING_OF_HARVEST_NORMAL_REDUCTION,
  FERTILE_SOIL_EXTRA_DROP,
  OATH_OF_CULTIVATION_MAX_POTS,
} from "./skillTables";

/** 소수점 반올림 */
function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 퍼센트 값 0~100 보정 */
function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * 농사 계산 핵심 로직
 *
 * 핵심 해석:
 * 1) 등급은 가중치 비율 방식
 * 2) 비옥한 토양 = 수확 판정 1회 추가 확률
 * 3) 작물 2개 드롭률 = 수확 1회 결과물 +1 기대값
 * 4) 경험치는 이 함수에서 직접 계산하지 않으며,
 *    "수확 판정 횟수"를 별도로 반환해서 exp 계산에 사용
 */
export function calculateFarming(
  input: FarmingCalculationInput
): FarmingCalculationResult {
  const { luck, sense } = input.stats;
  const { blessingOfHarvest, fertileSoil, oathOfCultivation } = input.skills;
  const { potCount, thirst } = input.environment;
  const { normal, advanced, rare } = input.prices;

  // 1) 스킬 수치 조회
  const normalReduction =
    BLESSING_OF_HARVEST_NORMAL_REDUCTION[blessingOfHarvest] ?? 0;

  const fertileSoilRatePercent =
    FERTILE_SOIL_EXTRA_DROP[fertileSoil] ?? 0;

  const maxPotCountBySkill =
    OATH_OF_CULTIVATION_MAX_POTS[oathOfCultivation] ?? 96;

  // 2) 등급 가중치 계산
  // 첨부 이미지 기준
  // 일반 : 150 - 일반 작물 감소비율
  // 고급 : 30 + (1.5 * 행운)
  // 희귀 : 15 + (1.5 * 행운)
  const normalWeight = Math.max(0, 150 - normalReduction);
  const advancedWeight = Math.max(0, 30 + 1.5 * luck);
  const rareWeight = Math.max(0, 15 + 1.5 * luck);
  const totalWeight = normalWeight + advancedWeight + rareWeight;

  const normalProbability = totalWeight > 0 ? normalWeight / totalWeight : 0;
  const advancedProbability = totalWeight > 0 ? advancedWeight / totalWeight : 0;
  const rareProbability = totalWeight > 0 ? rareWeight / totalWeight : 0;

  // 3) 기타 비율 계산
  // 씨앗 드롭률 = 50 + 행운
  const seedDropRatePercent = clampPercent(50 + luck);

  // 작물 2개 드롭률 = (5 * 갈증 1.0%) + (0.8 * 감각)
  // 예: 갈증 3, 감각 67 => 15 + 53.6 = 68.6%
  const doubleDropRatePercent = clampPercent(thirst * 5 + sense * 0.8);

  // 4) 기대 수확 판정 횟수
  // 비옥한 토양은 "재배가 1번 더 이루어지는 것"으로 해석
  // 즉, 수확 판정 자체가 한 번 더 발생하는 기대값
  const fertileSoilRate = fertileSoilRatePercent / 100;
  const expectedHarvestAttemptsPerPot = 1 + fertileSoilRate;
  const expectedHarvestAttemptsPerCycle =
    potCount * expectedHarvestAttemptsPerPot;

  // 5) 수확 1회당 기대 작물 개수
  // 기본 1개 + 작물 2개 드롭 성공 시 +1개
  // 작물 2개 드롭은 경험치 추가 없음
  const doubleDropRate = doubleDropRatePercent / 100;
  const expectedCropsPerHarvestAttempt = 1 + doubleDropRate;

  // 6) 총 기대 작물 개수
  // 비옥한 토양으로 추가된 재배에도 2개 드롭률 / 등급 확률이 동일 적용
  const expectedTotalCropsPerCycle =
    expectedHarvestAttemptsPerCycle * expectedCropsPerHarvestAttempt;

  // 7) 등급별 기대 개수
  const normalExpectedCount =
    expectedTotalCropsPerCycle * normalProbability;
  const advancedExpectedCount =
    expectedTotalCropsPerCycle * advancedProbability;
  const rareExpectedCount =
    expectedTotalCropsPerCycle * rareProbability;

  // 8) 기대 수익
  const expectedRevenuePerCycle =
    normalExpectedCount * normal +
    advancedExpectedCount * advanced +
    rareExpectedCount * rare;

  return {
    intermediate: {
      normalWeight: round(normalWeight),
      advancedWeight: round(advancedWeight),
      rareWeight: round(rareWeight),
      totalWeight: round(totalWeight),

      normalProbability: round(normalProbability),
      advancedProbability: round(advancedProbability),
      rareProbability: round(rareProbability),

      seedDropRatePercent: round(seedDropRatePercent),
      fertileSoilRatePercent: round(fertileSoilRatePercent),
      doubleDropRatePercent: round(doubleDropRatePercent),

      maxPotCountBySkill: maxPotCountBySkill,

      expectedHarvestAttemptsPerPot: round(expectedHarvestAttemptsPerPot),
      expectedHarvestAttemptsPerCycle: round(expectedHarvestAttemptsPerCycle),

      expectedCropsPerHarvestAttempt: round(expectedCropsPerHarvestAttempt),
      expectedTotalCropsPerCycle: round(expectedTotalCropsPerCycle),
    },

    normalExpectedCount: round(normalExpectedCount),
    advancedExpectedCount: round(advancedExpectedCount),
    rareExpectedCount: round(rareExpectedCount),

    expectedRevenuePerCycle: round(expectedRevenuePerCycle),
  };
}
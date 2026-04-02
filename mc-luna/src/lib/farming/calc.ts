// src/lib/farming/calc.ts

import type {
  FarmingCalculationInput,
  FarmingCalculationResult,
  FarmingThirstMin,
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
 * 갈증 최소치에 대한 유효 계수 계산 함수
 * - 낚시 계산기와 동일한 기준 사용
 */
function getEffectiveThirstMultiplier(thirstMin: FarmingThirstMin): number {
  switch (thirstMin) {
    case 15:
      return 1;
    case 10:
      return (6 * 1 + 5 * 0.75) / 11;
    case 5:
      return (6 * 1 + 5 * 0.75 + 5 * 0.5) / 16;
    case 1:
      return (6 * 1 + 5 * 0.75 + 5 * 0.5 + 4 * 0.25) / 20;
    default:
      return 1;
  }
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
 *
 * 이번 수정:
 * - 일반 작물 감소비율을
 *   a) 풍년의 축복 스킬 감소값
 *   b) 도감 효과 감소값
 *   두 부분으로 나눠 계산하고 합산 적용
 * 
 * 이번 수정:
 * - 갈증 수치는 직접 숫자를 쓰지 않고
 *   "갈증 최소치 → 유효 계수 → 유효 갈증값" 순서로 계산
 * - 최종 작물 2개 드롭률:
 *   (유효 갈증값 * 5) + (0.8 * 감각)
 */
export function calculateFarming(
  input: FarmingCalculationInput,
): FarmingCalculationResult {
  const { luck, sense, normalCropReduction } = input.stats;
  const { blessingOfHarvest, fertileSoil, oathOfCultivation } = input.skills;
  const { potCount, thirstMin } = input.environment;
  const { normal, advanced, rare } = input.prices;

  // 1) 스킬 수치 조회
  const skillNormalReduction =
    BLESSING_OF_HARVEST_NORMAL_REDUCTION[blessingOfHarvest] ?? 0;

  const fertileSoilRatePercent =
    FERTILE_SOIL_EXTRA_DROP[fertileSoil] ?? 0;

  const maxPotCountBySkill =
    OATH_OF_CULTIVATION_MAX_POTS[oathOfCultivation] ?? 96;

  /**
   * 도감 효과 감소값
   *
   * 음수는 의미가 없으므로 0 미만은 잘라낸다.
   */
  const codexNormalReduction = Math.max(0, normalCropReduction);

  /**
   * 최종 일반 작물 감소비율
   * = 풍년의 축복 감소 + 도감 감소
   */
  const totalNormalReduction = skillNormalReduction + codexNormalReduction;

  // 2) 등급 가중치 계산
  // 일반 : 150 - 일반 작물 감소비율(스킬 + 도감)
  // 고급 : 30 + (1.5 * 행운)
  // 희귀 : 15 + (1.5 * 행운)
  const normalWeight = Math.max(0, 150 - totalNormalReduction);
  const advancedWeight = Math.max(0, 30 + 1.5 * luck);
  const rareWeight = Math.max(0, 15 + 1.5 * luck);
  const totalWeight = normalWeight + advancedWeight + rareWeight;

  const normalProbability = totalWeight > 0 ? normalWeight / totalWeight : 0;
  const advancedProbability = totalWeight > 0 ? advancedWeight / totalWeight : 0;
  const rareProbability = totalWeight > 0 ? rareWeight / totalWeight : 0;

  // 3) 기타 비율 계산
  // 씨앗 드롭률 = 50 + 행운
  const seedDropRatePercent = clampPercent(50 + luck);

  /**
   * 갈증 최소치 기반 유효 갈증값 계산
   * 예:
   * - 15 => 15
   * - 10 => 15 * 유효계수
   */
  const effectiveThirstMultiplier = getEffectiveThirstMultiplier(thirstMin);
  const effectiveThirstValue = 15 * effectiveThirstMultiplier;

  // 작물 2개 드롭률 = (유효 갈증값 * 5) + (0.8 * 감각)
  const doubleDropRatePercent = clampPercent(effectiveThirstValue + sense * 0.8);

  // 4) 기대 수확 판정 횟수
  const fertileSoilRate = fertileSoilRatePercent / 100;
  const expectedHarvestAttemptsPerPot = 1 + fertileSoilRate;
  const expectedHarvestAttemptsPerCycle =
    potCount * expectedHarvestAttemptsPerPot;

  // 5) 수확 1회당 기대 작물 개수
  const doubleDropRate = doubleDropRatePercent / 100;
  const expectedCropsPerHarvestAttempt = 1 + doubleDropRate;

  // 6) 총 기대 작물 개수
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

      skillNormalReduction: round(skillNormalReduction),
      codexNormalReduction: round(codexNormalReduction),
      totalNormalReduction: round(totalNormalReduction),

      effectiveThirstMultiplier: round(effectiveThirstMultiplier),
      effectiveThirstValue: round(effectiveThirstValue),

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
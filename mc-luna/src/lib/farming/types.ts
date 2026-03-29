// src/lib/farming/types.ts

export type FarmingCropType =
  | "lettuce"
  | "corn"
  | "cabbage"
  | "radish"
  | "tomato"
  | "strawberry"
  | "grape"
  | "lemon"
  | "orange"
  | "pineapple"
  | "banana"
  | "pomegranate";

export interface FarmingStats {
  /** 행운 */
  luck: number;
  /** 감각 */
  sense: number;
}

export interface FarmingSkills {
  /** 풍년의 축복 */
  blessingOfHarvest: number;
  /** 비옥한 토양 */
  fertileSoil: number;
  /** 개간의 서약 */
  oathOfCultivation: number;
}

export interface FarmingEnvironment {
  /** 총 화분통 수 */
  potCount: number;
  /** 갈증값(예: 5 -> 5%) */
  thirst: number;
  /** 작물 종류 */
  cropType: FarmingCropType;
}

export interface FarmingPrices {
  normal: number;
  advanced: number;
  rare: number;
}

export interface FarmingCalculationInput {
  stats: FarmingStats;
  skills: FarmingSkills;
  environment: FarmingEnvironment;
  prices: FarmingPrices;
}

export interface FarmingIntermediateResult {
  // 등급 가중치
  normalWeight: number;
  advancedWeight: number;
  rareWeight: number;
  totalWeight: number;

  // 등급 확률
  normalProbability: number;
  advancedProbability: number;
  rareProbability: number;

  // 기타 확률
  seedDropRatePercent: number;
  fertileSoilRatePercent: number;
  doubleDropRatePercent: number;

  // 최대 화분통
  maxPotCountBySkill: number;

  // 수확 판정 관련 기대값
  expectedHarvestAttemptsPerPot: number;
  expectedHarvestAttemptsPerCycle: number;

  // 작물 개수 관련 기대값
  expectedCropsPerHarvestAttempt: number;
  expectedTotalCropsPerCycle: number;
}

export interface FarmingCalculationResult {
  intermediate: FarmingIntermediateResult;

  // 등급별 기대 개수
  normalExpectedCount: number;
  advancedExpectedCount: number;
  rareExpectedCount: number;

  // 기대 수익
  expectedRevenuePerCycle: number;
}
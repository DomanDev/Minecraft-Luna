// src/lib/farming/types.ts

/**
 * 농사 계산기에서 사용하는 공통 타입 정의
 *
 * 이번 수정의 핵심:
 * 1) 농사 스킬 타입은 farming 전체 스킬 5개를 모두 담을 수 있게 확장
 * 2) 하지만 실제 계산(calc.ts)에 반영되는 것은
 *    현재 정책상 아래 3개만 유지
 *    - 풍년의 축복
 *    - 비옥한 토양
 *    - 개간의 서약
 * 3) 액티브 스킬
 *    - 수확의 손길
 *    - 되뿌리기
 *    는 "저장/불러오기/확장 대비용"으로만 포함
 *    현재 기대 수익 계산에는 사용하지 않음
 */

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

/**
 * 농사 계산에 직접 사용하는 스탯
 *
 * 현재 정책:
 * - 행운
 * - 감각
 * 만 사용
 *
 * 참고:
 * - "경작지당 화분통 설치 개수"는 ./생활 정보에 보일 수 있지만
 *   계산기에서는 사용하지 않음
 * - 화분통 최대치는 개간의 서약 레벨로 계산
 */
export interface FarmingStats {
  /** 행운 */
  luck: number;

  /** 감각 */
  sense: number;
}

/**
 * 농사 스킬 전체 구조
 *
 * 현재 계산에 직접 쓰는 값:
 * - blessingOfHarvest
 * - fertileSoil
 * - oathOfCultivation
 *
 * 현재 계산에 쓰지 않는 값:
 * - handOfHarvest
 * - reseeding
 *
 * 그래도 타입에는 포함해 두는 이유:
 * - 프로필 자동 불러오기
 * - DB 저장 구조 정합성
 * - 향후 UI 표시 / 확장 대응
 */
export interface FarmingSkills {
  /** 풍년의 축복 */
  blessingOfHarvest: number;

  /** 비옥한 토양 */
  fertileSoil: number;

  /** 개간의 서약 */
  oathOfCultivation: number;

  /** 수확의 손길 (현재 수익 계산에는 미사용) */
  handOfHarvest: number;

  /** 되뿌리기 (현재 수익 계산에는 미사용) */
  reseeding: number;
}

/**
 * 농사 환경 정보
 */
export interface FarmingEnvironment {
  /** 총 화분통 수 */
  potCount: number;

  /** 갈증값(예: 5 -> 5%) */
  thirst: number;

  /** 작물 종류 */
  cropType: FarmingCropType;
}

/**
 * 작물 평균 시세
 */
export interface FarmingPrices {
  normal: number;
  advanced: number;
  rare: number;
}

/**
 * 농사 계산 전체 입력
 */
export interface FarmingCalculationInput {
  stats: FarmingStats;
  skills: FarmingSkills;
  environment: FarmingEnvironment;
  prices: FarmingPrices;
}

/**
 * 계산 중간값
 *
 * UI에서 상세 계산 근거를 보여주기 위해 사용
 */
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

/**
 * 최종 계산 결과
 */
export interface FarmingCalculationResult {
  intermediate: FarmingIntermediateResult;

  // 등급별 기대 개수
  normalExpectedCount: number;
  advancedExpectedCount: number;
  rareExpectedCount: number;

  // 기대 수익
  expectedRevenuePerCycle: number;
}
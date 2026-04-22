/**
 * =========================
 * 생활 장비 강화 계산기 타입 정의
 * =========================
 *
 * 목적:
 * - UI 입력값 / 계산 결과 / 상세 단계 결과를 타입으로 명확히 분리한다.
 * - 추후 시뮬레이션 고도화나 추천 전략 확장 시에도 재사용 가능하게 만든다.
 */

export type EnhancementScrollType = "common" | "uncommon" | "rare";

export type EnhancementLevel =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

export type EnhancementStrategy = {
  /**
   * level n 값은
   * n강 -> n+1강 시도에 사용할 주문서를 의미한다.
   */
  [level: number]: EnhancementScrollType;
};

export type EnhancementOwnedMaterials = {
  commonScroll: number;
  uncommonScroll: number;
  rareScroll: number;
  protectionCharm: number;
  moonAuraPotion: number;
};

export type EnhancementCalculationInput = {
  currentLevel: EnhancementLevel;
  targetLevel: EnhancementLevel;

  /**
   * 하락 방지용 달빛 부적 사용 여부
   *
   * true:
   * - 하락은 막힘
   * - 단, 하락이 실제 발생할 상황에서만 부적이 소모된다고 가정
   */
  useProtectionCharm: boolean;

  /**
   * 요일별 부스트 적용 여부
   *
   * true:
   * - 강화 성공 확률에 1.1배를 적용
   * - 최종 성공 확률은 100%를 넘지 않도록 보정
   */
  applyWeekdayBoost: boolean;
  
  /**
   * 현재 달빛 기운 / 최대 달빛 기운
   *
   * 현재 1차 버전에서는 정보 표시용 성격이 크다.
   * 실제 계산은 "기운 복구 기대비용" 방식으로 반영한다.
   */
  currentMoonAura: number;
  maxMoonAura: number;

  prices: {
    commonScroll: number;
    uncommonScroll: number;
    rareScroll: number;
    protectionCharm: number;
    moonAuraPotion: number;
  };

  /**
   * 농축액 1개당 회복량
   *
   * 예:
   * - 10
   * - 20
   */
  moonAuraRecoveryPerPotion: number;

  /**
   * 보유 재료 수량
   *
   * 결과에서 "추가로 사야 하는 양"을 계산할 때 사용한다.
   */
  owned: EnhancementOwnedMaterials;

  /**
   * 단계별 주문서 전략
   */
  strategy: EnhancementStrategy;
};

export type EnhancementStepResult = {
  fromLevel: number;
  toLevelOnSuccess: number;
  scrollType: EnhancementScrollType;

  successRate: number;
  failRate: number;

  /**
   * 실패 시 하락 확률
   * - 현재 강화 단계 기준
   */
  dropRateOnFail: number;

  /**
   * 시도 1회 기준 실제 하락 확률
   * = failRate * dropRateOnFail
   */
  actualDropRatePerAttempt: number;

  /**
   * 시도 1회 기준 유지 확률
   * - 실패했지만 하락 없이 유지되는 확률
   */
  stayRatePerAttempt: number;

  /**
   * 주문서 1회 시도 비용
   */
  scrollCost: number;

  /**
   * 실패 1회 시 달빛 기운 감소량
   */
  moonAuraLossOnFail: number;

  /**
   * 시도 1회 기준 기대 기운 복구비
   */
  expectedMoonAuraRecoveryCostPerAttempt: number;

  /**
   * 시도 1회 기준 기대 부적 비용
   */
  expectedProtectionCostPerAttempt: number;

  /**
   * 시도 1회 기준 총 기대비용
   */
  expectedAttemptCost: number;

  /**
   * 해당 단계(fromLevel -> fromLevel+1)를 넘기기 위한 기대 총비용
   */
  expectedCostToClearStep: number;

  /**
   * 해당 단계 클리어까지의 기대 시도 횟수(근사치)
   *
   * 1차 버전에서는
   * "해당 단계 기대비용 / 시도 1회 기대비용" 으로 추정한다.
   * 이후 고도화 시 별도 기대 방문 횟수 계산으로 정밀화 가능.
   */
  expectedAttemptsToClearStep: number;
};

export type EnhancementPurchaseBreakdown = {
  expectedNeeded: number;
  owned: number;
  additionalNeeded: number;
  additionalCost: number;
};

export type EnhancementCalculationResult = {
  currentLevel: number;
  targetLevel: number;

  steps: EnhancementStepResult[];

  summary: {
    /**
     * 목표 단계까지의 총 기대비용
     * - 보유 재료 차감 전 기준
     */
    totalExpectedCost: number;
  };

  materials: {
    commonScroll: EnhancementPurchaseBreakdown;
    uncommonScroll: EnhancementPurchaseBreakdown;
    rareScroll: EnhancementPurchaseBreakdown;
    protectionCharm: EnhancementPurchaseBreakdown;
    moonAuraPotion: EnhancementPurchaseBreakdown;
  };

  ownedAdjusted: {
    /**
     * 사용자가 이미 가진 재료를 차감한 뒤
     * 추가 구매가 필요한 총 기대비용
     */
    totalAdditionalPurchaseCost: number;
  };

  notes: string[];
};
/**
 * =========================
 * 생활 장비 강화 계산기 타입 정의
 * =========================
 *
 * 목적:
 * - UI와 계산 로직이 서로 헷갈리지 않도록
 *   강화 계산기에 필요한 입력/출력 구조를 명확히 분리한다.
 * - 추후 시뮬레이션 확장이나 추천 전략 기능 추가 시에도
 *   타입을 그대로 재사용할 수 있게 만든다.
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
   * 현재 강화 단계에서 어떤 주문서를 사용할지 지정
   *
   * 예:
   * 0,1,2 -> common
   * 3,4,5 -> uncommon
   * 6,7,8,9 -> rare
   */
  [level: number]: EnhancementScrollType;
};

export type EnhancementCalculationInput = {
  /**
   * 현재 강화 단계
   */
  currentLevel: EnhancementLevel;

  /**
   * 목표 강화 단계
   */
  targetLevel: EnhancementLevel;

  /**
   * 부적 사용 여부
   *
   * true:
   * - 실패 시 하락이 발생해야만 부적 비용이 기대비용에 반영됨
   *
   * false:
   * - 하락 가능성이 그대로 계산에 반영됨
   */
  useProtectionCharm: boolean;

  /**
   * 현재 달빛 기운
   *
   * 현재 1차 버전에서는 "정보 표시용" 성격이 더 크고,
   * 실제 기대비용 계산은 기운 복구비 기대값 방식으로 반영한다.
   * 추후 2차 버전에서 상태 기반 시뮬레이션으로 확장 가능.
   */
  currentMoonAura: number;

  /**
   * 달빛 기운 최대치
   * 위키 기준 100
   */
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
   * - 10 회복
   * - 20 회복
   *
   * 서버 실제 아이템 규칙 확인 후 조정 가능.
   */
  moonAuraRecoveryPerPotion: number;

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
   * - 위키 기준 현재 강화 단계에 따라 달라짐
   * - 0~2강은 하락 없음
   */
  dropRateOnFail: number;

  /**
   * 전체 시도 기준 실제 하락 확률
   * = failRate * dropRateOnFail
   */
  actualDropRatePerAttempt: number;

  /**
   * 실패했지만 하락 없이 유지되는 확률
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
   * 시도 1회 기준 기대 달빛 기운 복구비
   */
  expectedMoonAuraRecoveryCostPerAttempt: number;

  /**
   * 시도 1회 기준 기대 부적 비용
   * - 부적 사용 시, 하락이 실제 발생하는 경우에만 소모
   */
  expectedProtectionCostPerAttempt: number;

  /**
   * 시도 1회 기준 총 즉시 기대비용
   */
  expectedAttemptCost: number;

  /**
   * 해당 단계(fromLevel -> fromLevel+1)를 넘기기 위한
   * 기대 총비용
   */
  expectedCostToClearStep: number;
};

export type EnhancementCalculationResult = {
  currentLevel: number;
  targetLevel: number;

  steps: EnhancementStepResult[];

  summary: {
    totalExpectedCost: number;
    totalExpectedScrollCost: number;
    totalExpectedProtectionCost: number;
    totalExpectedMoonAuraRecoveryCost: number;
  };

  notes: string[];
};
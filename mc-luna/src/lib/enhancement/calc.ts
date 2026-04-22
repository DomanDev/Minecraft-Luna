import type {
  EnhancementCalculationInput,
  EnhancementCalculationResult,
  EnhancementScrollType,
  EnhancementStepResult,
} from "./types";

/**
 * =========================
 * 생활 장비 강화 계산 로직
 * =========================
 *
 * 현재 설계 목표:
 * 1) 위키에 공개된 성공 확률 / 하락 확률 / 주문서 특성을 반영한다.
 * 2) 단계별 기대비용을 계산한다.
 * 3) 보유 재료 차감 후 실제 추가 구매 비용도 계산한다.
 *
 * 핵심 개념:
 * - 강화 단계 L에서 목표 단계까지 가는 기대 총비용 E[L]를 계산
 * - 성공 시: L -> L+1
 * - 실패 + 하락 시: L -> L-1
 * - 실패 + 유지 시: L -> L
 *
 * 기대비용 식:
 * E[L] = C + pSuccess * E[L+1] + pDrop * E[L-1] + pStay * E[L]
 *
 * 정리:
 * E[L] = (C + pSuccess * E[L+1] + pDrop * E[L-1]) / (1 - pStay)
 *
 * 여기서:
 * - C = 시도 1회 기준 즉시 기대비용
 * - pDrop = failRate * dropRateOnFail
 * - pStay = failRate * (1 - dropRateOnFail)
 *
 * 부적 사용 시:
 * - 하락은 막히므로 상태 전이상 pDrop = 0
 * - 대신 "하락이 발생할 상황"에만 부적이 소모되므로
 *   기대 부적 비용을 C에 포함한다.
 */

/**
 * 현재 강화 단계 기준 성공 확률
 *
 * 의미:
 * - 0 값은 0 -> 1 성공 확률
 * - 1 값은 1 -> 2 성공 확률
 * ...
 * - 9 값은 9 -> 10 성공 확률
 */
const SUCCESS_RATE_BY_LEVEL: Record<number, number> = {
  0: 0.7,
  1: 0.65,
  2: 0.6,
  3: 0.45,
  4: 0.38,
  5: 0.31,
  6: 0.18,
  7: 0.12,
  8: 0.07,
  9: 0.04,
};

/**
 * 현재 강화 단계 기준 실패 시 하락 확률
 *
 * 0~2강은 하락 없음
 */
const DROP_RATE_ON_FAIL_BY_LEVEL: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 0.1,
  4: 0.15,
  5: 0.2,
  6: 0.25,
  7: 0.3,
  8: 0.35,
  9: 0.4,
};

/**
 * 요일별 부스트 적용 시 강화 성공 확률 배수
 *
 * 예: 10% 증가 -> x1.1
 */
const WEEKDAY_BOOST_MULTIPLIER = 1.1;

/**
 * 주문서 종류별 메타 정보
 *
 * 위키 기준:
 * - common: 0~9 사용 가능, 성공 시 +1, 실패 시 기운 -5
 * - uncommon: 3~9 사용 가능, 성공 시 +2, 실패 시 기운 -10
 * - rare: 6~9 사용 가능, 성공 시 +4, 실패 시 기운 -20
 */
const SCROLL_META: Record<
  EnhancementScrollType,
  {
    minLevel: number;
    maxLevel: number;
    statIncreaseOnSuccess: number;
    moonAuraLossOnFail: number;
  }
> = {
  common: {
    minLevel: 0,
    maxLevel: 9,
    statIncreaseOnSuccess: 1,
    moonAuraLossOnFail: 5,
  },
  uncommon: {
    minLevel: 3,
    maxLevel: 9,
    statIncreaseOnSuccess: 2,
    moonAuraLossOnFail: 10,
  },
  rare: {
    minLevel: 6,
    maxLevel: 9,
    statIncreaseOnSuccess: 4,
    moonAuraLossOnFail: 20,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getScrollLabel(scrollType: EnhancementScrollType): string {
  switch (scrollType) {
    case "common":
      return "일반 주문서";
    case "uncommon":
      return "고급 주문서";
    case "rare":
      return "희귀 주문서";
    default:
      return "주문서";
  }
}

function getScrollCost(
  input: EnhancementCalculationInput,
  scrollType: EnhancementScrollType,
): number {
  switch (scrollType) {
    case "common":
      return input.prices.commonScroll;
    case "uncommon":
      return input.prices.uncommonScroll;
    case "rare":
      return input.prices.rareScroll;
    default:
      return 0;
  }
}

function validateScrollUsable(level: number, scrollType: EnhancementScrollType) {
  const meta = SCROLL_META[scrollType];

  if (level < meta.minLevel || level > meta.maxLevel) {
    throw new Error(
      `${level}강 구간에서는 ${getScrollLabel(scrollType)}를 사용할 수 없습니다.`,
    );
  }
}

function getSuccessRate(
  level: number,
  applyWeekdayBoost = false,
): number {
  const baseSuccessRate = SUCCESS_RATE_BY_LEVEL[level] ?? 0;

  if (!applyWeekdayBoost) {
    return baseSuccessRate;
  }

  /**
   * 요일별 부스트 적용 시 성공 확률 1.1배
   * 혹시라도 100%를 넘는 경우를 대비해 clamp 처리
   */
  return clamp(baseSuccessRate * WEEKDAY_BOOST_MULTIPLIER, 0, 1);
}

function getDropRateOnFail(level: number): number {
  return DROP_RATE_ON_FAIL_BY_LEVEL[level] ?? 0;
}

/**
 * 단계별 1회 시도 기준 기대비용 성분 계산
 */
function buildStepBaseCost(
  input: EnhancementCalculationInput,
  level: number,
  scrollType: EnhancementScrollType,
) {
  const successRate = getSuccessRate(level, input.applyWeekdayBoost);
  const failRate = 1 - successRate;
  const dropRateOnFail = getDropRateOnFail(level);

  const scrollMeta = SCROLL_META[scrollType];
  const scrollCost = getScrollCost(input, scrollType);

  /**
   * 농축액 1개당 회복량 기반
   * 기운 1당 비용 계산
   *
   * 0 이하 입력 방지용으로 최소 1 보정
   */
  const recoveryPerPotion = Math.max(1, input.moonAuraRecoveryPerPotion);
  const moonAuraCostPerPoint = input.prices.moonAuraPotion / recoveryPerPotion;

  /**
   * 시도 1회 기준 기대 기운 복구비
   *
   * failRate * 실패 시 기운 감소량 * 기운 1당 비용
   */
  const expectedMoonAuraRecoveryCostPerAttempt =
    failRate * scrollMeta.moonAuraLossOnFail * moonAuraCostPerPoint;

  /**
   * 시도 1회 기준 실제 하락 발생 확률
   */
  const actualDropRatePerAttempt = failRate * dropRateOnFail;

  /**
   * 부적 사용 시:
   * - 하락이 실제 발생할 상황에서만 소모된다고 가정
   */
  const expectedProtectionCostPerAttempt = input.useProtectionCharm
    ? actualDropRatePerAttempt * input.prices.protectionCharm
    : 0;

  /**
   * 시도 1회 기준 총 기대비용
   */
  const expectedAttemptCost =
    scrollCost +
    expectedMoonAuraRecoveryCostPerAttempt +
    expectedProtectionCostPerAttempt;

  return {
    successRate,
    failRate,
    dropRateOnFail,
    actualDropRatePerAttempt,
    expectedMoonAuraRecoveryCostPerAttempt,
    expectedProtectionCostPerAttempt,
    expectedAttemptCost,
    moonAuraLossOnFail: scrollMeta.moonAuraLossOnFail,
    scrollCost,
  };
}

/**
 * 기대 소모량과 보유량을 비교하여
 * 실제 추가 구매 필요량과 비용 계산
 */
function buildPurchaseBreakdown(
  expectedNeeded: number,
  owned: number,
  unitPrice: number,
) {
  const safeExpectedNeeded = Math.max(expectedNeeded, 0);
  const safeOwned = Math.max(owned, 0);

  /**
   * 이미 가진 재료는 기대 필요량에서 차감
   * 초과 보유 시 0 아래로 내려가지 않도록 clamp
   */
  const additionalNeeded = Math.max(safeExpectedNeeded - safeOwned, 0);

  return {
    expectedNeeded: safeExpectedNeeded,
    owned: safeOwned,
    additionalNeeded,
    additionalCost: additionalNeeded * unitPrice,
  };
}

function solveExpectedCosts(
  input: EnhancementCalculationInput,
): EnhancementCalculationResult {
  const currentLevel = input.currentLevel;
  const targetLevel = input.targetLevel;

  if (targetLevel <= currentLevel) {
    return {
      currentLevel,
      targetLevel,
      steps: [],
      summary: {
        totalExpectedCost: 0,
      },
      materials: {
        commonScroll: buildPurchaseBreakdown(
          0,
          input.owned.commonScroll,
          input.prices.commonScroll,
        ),
        uncommonScroll: buildPurchaseBreakdown(
          0,
          input.owned.uncommonScroll,
          input.prices.uncommonScroll,
        ),
        rareScroll: buildPurchaseBreakdown(
          0,
          input.owned.rareScroll,
          input.prices.rareScroll,
        ),
        protectionCharm: buildPurchaseBreakdown(
          0,
          input.owned.protectionCharm,
          input.prices.protectionCharm,
        ),
        moonAuraPotion: buildPurchaseBreakdown(
          0,
          input.owned.moonAuraPotion,
          input.prices.moonAuraPotion,
        ),
      },
      ownedAdjusted: {
        totalAdditionalPurchaseCost: 0,
      },
      notes: [
        "현재 강화 단계가 목표 단계 이상이므로 추가 강화 비용은 0입니다.",
      ],
    };
  }

  const minLevel = currentLevel;
  const maxLevel = targetLevel;

  /**
   * 각 단계의 1회 시도 기준 정보 미리 계산
   */
  const stepBaseInfo = new Map<number, ReturnType<typeof buildStepBaseCost>>();

  for (let level = minLevel; level < maxLevel; level += 1) {
    const scrollType = input.strategy[level];
    validateScrollUsable(level, scrollType);
    stepBaseInfo.set(level, buildStepBaseCost(input, level, scrollType));
  }

  /**
   * E[level] = level에서 목표까지 가는 기대 총비용
   *
   * 초기값 0에서 시작해 반복 수렴
   */
  const expectedCostMap = new Map<number, number>();

  for (let level = minLevel; level <= maxLevel; level += 1) {
    expectedCostMap.set(level, 0);
  }

  /**
   * 상태 수가 매우 작기 때문에
   * 반복 수렴 방식으로 충분히 안정적으로 계산 가능
   */
  for (let iteration = 0; iteration < 2000; iteration += 1) {
    expectedCostMap.set(maxLevel, 0);

    for (let level = maxLevel - 1; level >= minLevel; level -= 1) {
      const base = stepBaseInfo.get(level);

      if (!base) continue;

      const successRate = base.successRate;
      const failRate = base.failRate;

      let pDrop = 0;
      let pStay = 0;

      if (input.useProtectionCharm) {
        /**
         * 부적 사용 시:
         * - 하락은 막히므로 상태 전이는 실패 시 그대로 유지
         */
        pDrop = 0;
        pStay = failRate;
      } else {
        /**
         * 부적 미사용 시:
         * - 실패 중 일부는 하락
         * - 나머지는 제자리 유지
         */
        pDrop = base.actualDropRatePerAttempt;
        pStay = failRate - pDrop;
      }

      const nextLevelOnSuccess = Math.min(level + 1, maxLevel);
      const nextLevelOnDrop = clamp(level - 1, 0, 10);

      const eSuccess = expectedCostMap.get(nextLevelOnSuccess) ?? 0;
      const eDrop =
        nextLevelOnDrop >= minLevel
          ? expectedCostMap.get(nextLevelOnDrop) ?? 0
          : 0;

      const denominator = 1 - pStay;

      const nextExpectedCost =
        denominator > 0
          ? (base.expectedAttemptCost +
              successRate * eSuccess +
              pDrop * eDrop) /
            denominator
          : Number.POSITIVE_INFINITY;

      expectedCostMap.set(level, nextExpectedCost);
    }
  }

  const steps: EnhancementStepResult[] = [];

  /**
   * 기대 재료 소모량 근사치 누적
   *
   * 1차 버전에서는
   * 해당 단계의 기대 시도 횟수 ≒ 단계 기대비용 / 시도 1회 기대비용
   * 으로 계산한다.
   *
   * 완전 정밀한 기대 방문 횟수 분해는 이후 고도화 단계에서 가능.
   */
  let expectedCommonScrolls = 0;
  let expectedUncommonScrolls = 0;
  let expectedRareScrolls = 0;
  let expectedProtectionCharms = 0;
  let expectedMoonAuraPotions = 0;

  for (let level = minLevel; level < maxLevel; level += 1) {
    const scrollType = input.strategy[level];
    const base = stepBaseInfo.get(level);

    if (!base) continue;

    const successRate = base.successRate;
    const failRate = base.failRate;

    const actualDropRatePerAttempt = input.useProtectionCharm
      ? 0
      : base.actualDropRatePerAttempt;

    const stayRatePerAttempt = input.useProtectionCharm
      ? failRate
      : failRate - actualDropRatePerAttempt;

    const stepExpectedCost =
      (expectedCostMap.get(level) ?? 0) - (expectedCostMap.get(level + 1) ?? 0);

    /**
     * 시도 1회 기대비용이 0보다 큰 경우에만
     * 기대 시도 횟수 근사치를 계산
     */
    const expectedAttemptsToClearStep =
      base.expectedAttemptCost > 0
        ? stepExpectedCost / base.expectedAttemptCost
        : 0;

    /**
     * 주문서 기대 소모량
     * - 시도 1회당 주문서 1장 사용
     */
    if (scrollType === "common") {
      expectedCommonScrolls += expectedAttemptsToClearStep;
    } else if (scrollType === "uncommon") {
      expectedUncommonScrolls += expectedAttemptsToClearStep;
    } else if (scrollType === "rare") {
      expectedRareScrolls += expectedAttemptsToClearStep;
    }

    /**
     * 부적 기대 소모량
     * - 하락이 실제 발생할 상황에서만 소비
     * - 기대 시도 횟수 * 시도당 기대 부적 소모량
     */
    if (input.useProtectionCharm && input.prices.protectionCharm > 0) {
      const expectedProtectionPerAttempt =
        base.expectedProtectionCostPerAttempt / input.prices.protectionCharm;
      expectedProtectionCharms +=
        expectedAttemptsToClearStep * expectedProtectionPerAttempt;
    }

    /**
     * 농축액 기대 소모량
     * - 기운 복구비 기대값을 농축액 가격으로 환산
     */
    if (input.prices.moonAuraPotion > 0) {
      const expectedPotionPerAttempt =
        base.expectedMoonAuraRecoveryCostPerAttempt / input.prices.moonAuraPotion;
      expectedMoonAuraPotions += expectedAttemptsToClearStep * expectedPotionPerAttempt;
    }

    steps.push({
      fromLevel: level,
      toLevelOnSuccess: level + 1,
      scrollType,
      successRate,
      failRate,
      dropRateOnFail: base.dropRateOnFail,
      actualDropRatePerAttempt,
      stayRatePerAttempt,
      scrollCost: base.scrollCost,
      moonAuraLossOnFail: base.moonAuraLossOnFail,
      expectedMoonAuraRecoveryCostPerAttempt:
        base.expectedMoonAuraRecoveryCostPerAttempt,
      expectedProtectionCostPerAttempt: base.expectedProtectionCostPerAttempt,
      expectedAttemptCost: base.expectedAttemptCost,
      expectedCostToClearStep: stepExpectedCost,
      expectedAttemptsToClearStep,
    });
  }

  const totalExpectedCost = expectedCostMap.get(currentLevel) ?? 0;

  /**
   * 보유 재료 차감 후 실제 추가 구매 필요량 계산
   */
  const commonScrollBreakdown = buildPurchaseBreakdown(
    expectedCommonScrolls,
    input.owned.commonScroll,
    input.prices.commonScroll,
  );

  const uncommonScrollBreakdown = buildPurchaseBreakdown(
    expectedUncommonScrolls,
    input.owned.uncommonScroll,
    input.prices.uncommonScroll,
  );

  const rareScrollBreakdown = buildPurchaseBreakdown(
    expectedRareScrolls,
    input.owned.rareScroll,
    input.prices.rareScroll,
  );

  const protectionCharmBreakdown = buildPurchaseBreakdown(
    expectedProtectionCharms,
    input.owned.protectionCharm,
    input.prices.protectionCharm,
  );

  const moonAuraPotionBreakdown = buildPurchaseBreakdown(
    expectedMoonAuraPotions,
    input.owned.moonAuraPotion,
    input.prices.moonAuraPotion,
  );

  const totalAdditionalPurchaseCost =
    commonScrollBreakdown.additionalCost +
    uncommonScrollBreakdown.additionalCost +
    rareScrollBreakdown.additionalCost +
    protectionCharmBreakdown.additionalCost +
    moonAuraPotionBreakdown.additionalCost;

  return {
    currentLevel,
    targetLevel,
    steps,
    summary: {
      totalExpectedCost,
    },
    materials: {
      commonScroll: commonScrollBreakdown,
      uncommonScroll: uncommonScrollBreakdown,
      rareScroll: rareScrollBreakdown,
      protectionCharm: protectionCharmBreakdown,
      moonAuraPotion: moonAuraPotionBreakdown,
    },
    ownedAdjusted: {
      totalAdditionalPurchaseCost,
    },
    notes: [
      input.applyWeekdayBoost
        ? "요일별 부스트를 적용하여 강화 성공 확률에 x1.1배를 반영했습니다."
        : "강화 성공 확률은 기본 확률 기준으로 계산했습니다.",
      "성공 확률과 하락 확률은 현재 강화 단계 기준으로 계산했습니다.",
      "달빛 부적은 하락이 실제 발생하는 경우에만 기대 소모량에 반영했습니다.",
      "달빛 기운 복구비는 주문서 실패 시 기대 소모량 기준으로 계산했습니다.",
      "보유 재료 차감은 기대 소모량 기준으로 계산한 1차 버전입니다.",
      "단계별 기대 시도 횟수는 근사치이며, 추후 정밀 방문 횟수 계산으로 고도화할 수 있습니다.",
    ],
  };
}

export function calculateEnhancement(
  input: EnhancementCalculationInput,
): EnhancementCalculationResult {
  if (input.currentLevel < 0 || input.currentLevel > 10) {
    throw new Error("현재 강화 단계는 0~10 사이여야 합니다.");
  }

  if (input.targetLevel < 0 || input.targetLevel > 10) {
    throw new Error("목표 강화 단계는 0~10 사이여야 합니다.");
  }

  if (input.targetLevel <= input.currentLevel) {
    return {
      currentLevel: input.currentLevel,
      targetLevel: input.targetLevel,
      steps: [],
      summary: {
        totalExpectedCost: 0,
      },
      materials: {
        commonScroll: buildPurchaseBreakdown(
          0,
          input.owned.commonScroll,
          input.prices.commonScroll,
        ),
        uncommonScroll: buildPurchaseBreakdown(
          0,
          input.owned.uncommonScroll,
          input.prices.uncommonScroll,
        ),
        rareScroll: buildPurchaseBreakdown(
          0,
          input.owned.rareScroll,
          input.prices.rareScroll,
        ),
        protectionCharm: buildPurchaseBreakdown(
          0,
          input.owned.protectionCharm,
          input.prices.protectionCharm,
        ),
        moonAuraPotion: buildPurchaseBreakdown(
          0,
          input.owned.moonAuraPotion,
          input.prices.moonAuraPotion,
        ),
      },
      ownedAdjusted: {
        totalAdditionalPurchaseCost: 0,
      },
      notes: [
        "현재 강화 단계가 목표 단계 이상이므로 추가 강화 비용은 0입니다.",
      ],
    };
  }

  for (let level = input.currentLevel; level < input.targetLevel; level += 1) {
    const scrollType = input.strategy[level];

    if (!scrollType) {
      throw new Error(`${level}강 구간의 주문서 전략이 비어 있습니다.`);
    }

    validateScrollUsable(level, scrollType);
  }

  return solveExpectedCosts(input);
}

/**
 * 기본 추천 전략
 *
 * 일반적으로 많이 쓰는 방식:
 * - 0~2강: 일반
 * - 3~5강: 고급
 * - 6~9강: 희귀
 */
export function createRecommendedEnhancementStrategy() {
  return {
    0: "common",
    1: "common",
    2: "common",
    3: "uncommon",
    4: "uncommon",
    5: "uncommon",
    6: "rare",
    7: "rare",
    8: "rare",
    9: "rare",
  } as const;
}

export function getEnhancementStepSuccessRate(
  level: number,
  applyWeekdayBoost = false,
): number {
  return getSuccessRate(level, applyWeekdayBoost);
}

export function getEnhancementStepDropRateOnFail(level: number): number {
  return getDropRateOnFail(level);
}

export function getEnhancementScrollInfo(scrollType: EnhancementScrollType) {
  const meta = SCROLL_META[scrollType];

  return {
    ...meta,
    label: getScrollLabel(scrollType),
  };
}
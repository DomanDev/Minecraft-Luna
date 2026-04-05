import type {
  EnhancementCalculationInput,
  EnhancementCalculationResult,
  EnhancementLevel,
  EnhancementScrollType,
  EnhancementStepResult,
} from "./types";

/**
 * =========================
 * 생활 장비 강화 계산 로직
 * =========================
 *
 * 현재 설계 목표:
 * 1) 페이지 뼈대가 아니라 실제 기대비용 계산까지 가능하게 만든다.
 * 2) 위키에 공개된 성공 확률 / 하락 확률 / 주문서 특성을 반영한다.
 * 3) 달빛 기운은 "기대 복구비" 방식으로 1차 반영한다.
 *
 * 계산 방식 핵심:
 * - 강화 단계 L에서 다음 단계 L+1로 가는 기대비용 E[L]를 계산
 * - 성공 시: L -> L+1
 * - 실패 + 하락 시: L -> L-1
 * - 실패 + 유지 시: L -> L
 *
 * 기대비용 방정식:
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
 * 주의:
 * - 0~2강 구간처럼 하락이 없는 경우도 자연스럽게 처리됨
 * - 부적 사용 시 하락은 막지만,
 *   "하락이 실제 발생할 상황에서만 부적이 소모"되므로
 *   기대 부적 비용은 C에 포함한다.
 */

/**
 * 현재 강화 단계 기준 성공 확률
 *
 * 의미:
 * - level 0 값은 0 -> 1 강화 성공 확률
 * - level 1 값은 1 -> 2 강화 성공 확률
 * ...
 * - level 9 값은 9 -> 10 강화 성공 확률
 *
 * 위키 공개값 기준 반영
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
 * 의미:
 * - 3강 실패 시 10%
 * - 4강 실패 시 15%
 * ...
 * - 9강 실패 시 40%
 *
 * 0~2강은 하락 없음
 *
 * 위키 공개값 기준 반영
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
 * 주문서 종류별 정보
 *
 * 위키 기준:
 * - common: 0~9 사용 가능, 성공 시 +1, 실패 시 기운 -5
 * - uncommon: 3~9 사용 가능, 성공 시 +2, 실패 시 기운 -10
 * - rare: 6~9 사용 가능, 성공 시 +4, 실패 시 기운 -20
 *
 * 여기서 "성공 시 +스탯"은 비용 계산에는 직접 쓰지 않지만
 * 안내와 추후 효율 분석 확장을 위해 함께 둔다.
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

function getSuccessRate(level: number): number {
  return SUCCESS_RATE_BY_LEVEL[level] ?? 0;
}

function getDropRateOnFail(level: number): number {
  return DROP_RATE_ON_FAIL_BY_LEVEL[level] ?? 0;
}

/**
 * 단계별 1회 시도 기대비용 계산
 *
 * 구성:
 * 1) 주문서 비용
 * 2) 기대 달빛 기운 복구비
 * 3) 기대 부적 비용
 */
function buildStepBaseCost(
  input: EnhancementCalculationInput,
  level: number,
  scrollType: EnhancementScrollType,
) {
  const successRate = getSuccessRate(level);
  const failRate = 1 - successRate;
  const dropRateOnFail = getDropRateOnFail(level);

  const scrollMeta = SCROLL_META[scrollType];
  const scrollCost = getScrollCost(input, scrollType);

  /**
   * 농축액 1개당 회복량 기반으로
   * 달빛 기운 1당 비용 계산
   *
   * 0 이하가 들어오면 비정상 입력이므로
   * divide-by-zero 방지를 위해 최소 1로 보정
   */
  const recoveryPerPotion = Math.max(1, input.moonAuraRecoveryPerPotion);
  const moonAuraCostPerPoint = input.prices.moonAuraPotion / recoveryPerPotion;

  /**
   * 시도 1회 기준 기대 기운 복구비
   *
   * 실패 확률 * 실패 시 기운 감소량 * 기운 1당 비용
   */
  const expectedMoonAuraRecoveryCostPerAttempt =
    failRate * scrollMeta.moonAuraLossOnFail * moonAuraCostPerPoint;

  /**
   * 부적 사용 시:
   * - 하락이 실제 발생할 확률만큼 기대 부적 비용 반영
   * - 위키 기준 하락이 없으면 소모되지 않음
   */
  const actualDropRatePerAttempt = failRate * dropRateOnFail;

  const expectedProtectionCostPerAttempt = input.useProtectionCharm
    ? actualDropRatePerAttempt * input.prices.protectionCharm
    : 0;

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
 * 단계별 기대비용 계산
 *
 * 반환:
 * - steps: 각 단계 상세 결과
 * - totalExpectedCost: 전체 기대비용
 *
 * 구현 방식:
 * - 목표 단계 T에 대해 E[T] = 0
 * - 역방향으로 E[T-1], E[T-2], ... 계산
 *
 * 하지만 하락이 있는 경우 E[L-1]이 필요하므로
 * 단순 역방향 1패스로는 정확히 풀기 어렵다.
 * 따라서 상태 수가 작다는 점(0~10강)을 이용해
 * 연립방정식 형태를 반복 계산으로 수렴시킨다.
 *
 * 이유:
 * - 구현이 직관적이고 유지보수가 쉬움
 * - 10개 미만 상태라 계산 부담도 사실상 없음
 */
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
        totalExpectedScrollCost: 0,
        totalExpectedProtectionCost: 0,
        totalExpectedMoonAuraRecoveryCost: 0,
      },
      notes: [
        "현재 강화 단계가 목표 단계 이상이므로 추가 강화 비용은 0입니다.",
      ],
    };
  }

  /**
   * 현재 계산 대상 상태 범위
   * currentLevel ~ targetLevel
   */
  const minLevel = currentLevel;
  const maxLevel = targetLevel;

  /**
   * 각 단계별 기본 정보 미리 계산
   */
  const stepBaseInfo = new Map<number, ReturnType<typeof buildStepBaseCost>>();

  for (let level = minLevel; level < maxLevel; level += 1) {
    const scrollType = input.strategy[level];
    validateScrollUsable(level, scrollType);
    stepBaseInfo.set(level, buildStepBaseCost(input, level, scrollType));
  }

  /**
   * E[level] = 해당 level에서 목표까지 가는 기대 총비용
   *
   * 초기값 0으로 두고 반복 계산으로 수렴시킨다.
   */
  const expectedCostMap = new Map<number, number>();

  for (let level = minLevel; level <= maxLevel; level += 1) {
    expectedCostMap.set(level, 0);
  }

  /**
   * 반복 계산
   *
   * 상태 수가 적기 때문에 충분히 큰 횟수로 돌려도 부담이 거의 없다.
   * 수렴 안정성을 위해 2000회 정도면 충분하다.
   */
  for (let iteration = 0; iteration < 2000; iteration += 1) {
    /**
     * 목표 단계는 비용 0으로 고정
     */
    expectedCostMap.set(maxLevel, 0);

    for (let level = maxLevel - 1; level >= minLevel; level -= 1) {
      const base = stepBaseInfo.get(level);

      if (!base) continue;

      const successRate = base.successRate;
      const failRate = base.failRate;

      /**
       * 부적 사용 시 하락이 막히므로
       * 실제 상태 전이는:
       * - 성공: level+1
       * - 실패: 그대로 유지
       *
       * 부적 미사용 시:
       * - 성공: level+1
       * - 실패+하락: level-1 (단, currentLevel 아래로는 내려가지 않는다고 보지 않고
       *   실제 강화 단계는 0 아래로 떨어질 수 없으므로 0으로 clamp)
       * - 실패+유지: level
       */
      let pDrop = 0;
      let pStay = 0;

      if (input.useProtectionCharm) {
        pDrop = 0;
        pStay = failRate;
      } else {
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

      /**
       * 기대비용 식
       *
       * E[L] = C + pSuccess*E[L+1] + pDrop*E[L-1] + pStay*E[L]
       * => E[L] = (C + pSuccess*E[L+1] + pDrop*E[L-1]) / (1 - pStay)
       */
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

  /**
   * 단계별 결과 상세 구성
   *
   * 여기서는 "그 단계 하나를 넘기기 위한 기대비용"을
   * E[level] - E[level+1] 로 해석해서 보여준다.
   */
  const steps: EnhancementStepResult[] = [];

  let totalExpectedScrollCost = 0;
  let totalExpectedProtectionCost = 0;
  let totalExpectedMoonAuraRecoveryCost = 0;

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
     * 기대 재료비 상세 분리
     *
     * "정확한 단계별 기대 사용량"까지 분해하려면
     * 별도 사용량 기대값 계산이 추가로 필요하다.
     * 지금은 1차 버전이므로
     * 전체 기대비용 분해는 비율적으로 하지 않고,
     * 각 단계의 1회 시도 비용 성분을 누적 안내용으로만 보여준다.
     *
     * 오른쪽 summary 총계는 전체 단계 합으로 별도 계산한다.
     */
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
    });

    totalExpectedScrollCost += base.scrollCost;
    totalExpectedProtectionCost += base.expectedProtectionCostPerAttempt;
    totalExpectedMoonAuraRecoveryCost +=
      base.expectedMoonAuraRecoveryCostPerAttempt;
  }

  /**
   * summary 총계
   *
   * 현재 totalExpectedCost는
   * currentLevel에서 targetLevel까지 가는 기대 총비용
   */
  const totalExpectedCost = expectedCostMap.get(currentLevel) ?? 0;

  return {
    currentLevel,
    targetLevel,
    steps,
    summary: {
      totalExpectedCost,
      /**
       * 아래 3개 총계는 "단순 단계 합 안내치" 성격이 강하다.
       * 실제 totalExpectedCost와 정확히 일치시키려면
       * 각 단계 기대 방문 횟수까지 따로 풀어야 한다.
       *
       * 그래서 UI에서는 안내 문구로 설명하는 것이 안전하다.
       */
      totalExpectedScrollCost,
      totalExpectedProtectionCost,
      totalExpectedMoonAuraRecoveryCost,
    },
    notes: [
      "성공 확률과 하락 확률은 현재 강화 단계 기준으로 계산했습니다.",
      "달빛 부적은 하락이 실제 발생하는 경우에만 기대비용에 반영했습니다.",
      "달빛 기운 복구비는 주문서 실패 시 기대 소모량 기준으로 계산했습니다.",
      "요약 비용은 목표 단계까지의 기대 총비용이며, 상세 재료 소모량은 1차 버전 기준 안내용입니다.",
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
        totalExpectedScrollCost: 0,
        totalExpectedProtectionCost: 0,
        totalExpectedMoonAuraRecoveryCost: 0,
      },
      notes: [
        "현재 강화 단계가 목표 단계 이상이므로 추가 강화 비용은 0입니다.",
      ],
    };
  }

  /**
   * 전략이 비어 있거나 일부 구간이 누락되면
   * 계산 중 에러가 발생할 수 있으므로 사전 검증
   */
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

/**
 * 화면 표시용
 */
export function getEnhancementStepSuccessRate(level: number): number {
  return getSuccessRate(level);
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
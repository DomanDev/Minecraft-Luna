import { getCookingRecipe } from "./recipes";
import type {
  CookingCalculationInput,
  CookingCalculationResult,
} from "./types";

/**
 * -------------------------------------------------------
 * 요리 공식
 * -------------------------------------------------------
 * 1) 등급 상승 확률
 * = 기본 확률 + 요리 등급업 확률 + (0.1 * 손재주) + 미식가 보정
 *
 * 2) 요리 속도
 * = 기본 속도 - (0.2 * 손재주) * (1 - 조리 단축 / 100)
 * 이후 손질 달인은 별도 곱연산으로 추가 감소
 *
 * 3) 섭취 유지 시간
 * = 기본 시간 * (1 + 맛의 균형 / 100)
 * 이후 희귀 재료 추가 지속시간 가산
 *
 * 4) 요리 성공 확률
 * = 기본 확률 + (0.3 * 노련함)
 *
 * 5) 희귀 재료 보너스
 * - 레시피별 규칙에 따라 효과/지속시간 증가
 * - 체크된 재료 라인은 "라인 1개"가 아니라 해당 quantity 전체를 희귀 재료로 계산
 *   예: 토마토 x3 체크 -> 희귀 재료 3개로 카운트
 *
 * 6) 즉시 완성 / 연회 준비
 * - 즉시 완성:
 *   발동 시 해당 1회 제작 시간이 0초가 된다고 가정
 *
 * - 연회 준비:
 *   발동 시 "재료가 공짜"가 아니라
 *   인벤에 있는 재료가 자동 투입되어 추가 제작이 진행된다고 가정
 *   = 시간은 추가로 들지 않지만
 *   = 재료 원가 / 매출 / 경험치는 추가 제작 기대값만큼 반영
 *
 * 이번 수정:
 * - 액티브 스킬은 루나위키 수치표 기준으로 계산
 * - 경험치는 사용자 입력값 유지
 */

/**
 * -------------------------------------------------------
 * 패시브 스킬 테이블
 * -------------------------------------------------------
 * 손질 달인 / 맛의 균형 / 미식가 는
 * 기존 표를 유지한다.
 */
const PREPARATION_MASTER_REDUCTION_PERCENT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 12,
  12: 13,
  13: 15,
  14: 16,
  15: 18,
  16: 19,
  17: 21,
  18: 22,
  19: 24,
  20: 25,
  21: 28,
  22: 30,
  23: 33,
  24: 35,
  25: 38,
  26: 40,
  27: 43,
  28: 45,
  29: 48,
  30: 50,
};

const BALANCE_OF_TASTE_DURATION_BONUS_PERCENT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 12,
  12: 14,
  13: 16,
  14: 18,
  15: 20,
  16: 22,
  17: 24,
  18: 26,
  19: 28,
  20: 30,
  21: 34,
  22: 38,
  23: 42,
  24: 46,
  25: 50,
  26: 54,
  27: 58,
  28: 62,
  29: 66,
  30: 70,
};

const GOURMET_GRADE_UP_BONUS_PERCENT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 14,
  14: 16,
  15: 18,
  16: 20,
  17: 22,
  18: 24,
  19: 26,
  20: 28,
  21: 31,
  22: 34,
  23: 37,
  24: 40,
  25: 43,
  26: 46,
  27: 49,
  28: 52,
  29: 56,
  30: 60,
};

/**
 * -------------------------------------------------------
 * 액티브 스킬 테이블
 * -------------------------------------------------------
 * 루나위키 기준
 *
 * 즉시 완성:
 * - 레벨별 "즉시 완성 확률 (%)"
 *
 * 연회 준비:
 * - 레벨별 "다중 요리 확률 (%)"
 * - 레벨별 "추가 요리 횟수"
 */
const INSTANT_COMPLETION_PROC_CHANCE_PERCENT: Record<number, number> = {
  0: 0,
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 7,
  6: 8,
  7: 9,
  8: 10,
  9: 11,
  10: 12,
  11: 14,
  12: 16,
  13: 18,
  14: 20,
  15: 22,
  16: 24,
  17: 26,
  18: 28,
  19: 30,
  20: 31,
  21: 32,
  22: 33,
  23: 34,
  24: 35,
  25: 36,
  26: 37,
  27: 38,
  28: 39,
  29: 39,
  30: 40,
};

const BANQUET_PREPARATION_PROC_CHANCE_PERCENT: Record<number, number> = {
  0: 0,
  1: 8,
  2: 10,
  3: 12,
  4: 14,
  5: 16,
  6: 18,
  7: 20,
  8: 22,
  9: 24,
  10: 26,
  11: 28,
  12: 30,
  13: 32,
  14: 34,
  15: 36,
  16: 38,
  17: 40,
  18: 42,
  19: 44,
  20: 46,
  21: 48,
  22: 50,
  23: 52,
  24: 54,
  25: 56,
  26: 58,
  27: 60,
  28: 62,
  29: 64,
  30: 70,
};

const BANQUET_PREPARATION_EXTRA_CRAFT_COUNT: Record<number, number> = {
  0: 0,
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
  8: 1,
  9: 1,
  10: 1,
  11: 2,
  12: 2,
  13: 2,
  14: 2,
  15: 2,
  16: 2,
  17: 2,
  18: 3,
  19: 3,
  20: 3,
  21: 3,
  22: 3,
  23: 3,
  24: 4,
  25: 4,
  26: 4,
  27: 4,
  28: 5,
  29: 5,
  30: 5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getInstantCompletionProcChancePercent(level: number): number {
  return INSTANT_COMPLETION_PROC_CHANCE_PERCENT[level] ?? 0;
}

function getBanquetPreparationProcChancePercent(level: number): number {
  return BANQUET_PREPARATION_PROC_CHANCE_PERCENT[level] ?? 0;
}

function getBanquetPreparationExtraCraftCount(level: number): number {
  return BANQUET_PREPARATION_EXTRA_CRAFT_COUNT[level] ?? 0;
}

export function calculateCooking(
  input: CookingCalculationInput,
): CookingCalculationResult {
  const recipe = getCookingRecipe(input.recipeId);

  const {
    mastery,
    dexterity,
    cookingGradeUpChance,
    additionalCookTimeReductionPercent,
  } = input.stats;

  const {
    preparationMaster,
    balanceOfTaste,
    gourmet,
    instantCompletion,
    banquetPreparation,
    useInstantCompletion,
    useBanquetPreparation,
  } = input.skills;

  /**
   * -------------------------------------------------------
   * 1) 1회 제작 기준 재료 원가
   * -------------------------------------------------------
   */
  const ingredientCostPerCraft = recipe.ingredients.reduce((sum, ingredient) => {
    const unitPrice = input.prices.ingredientUnitPrices[ingredient.id] ?? 0;
    return sum + unitPrice * ingredient.quantity;
  }, 0);

  /**
   * -------------------------------------------------------
   * 2) 등급 / 성공 확률
   * -------------------------------------------------------
   */
  const dexterityGradeUpChancePercent = dexterity * 0.1;
  const gourmetGradeUpChancePercent =
    GOURMET_GRADE_UP_BONUS_PERCENT[gourmet] ?? 0;

  const finalSpecialChancePercent = clamp(
    recipe.baseSpecialChancePercent +
      cookingGradeUpChance +
      dexterityGradeUpChancePercent +
      gourmetGradeUpChancePercent,
    0,
    100,
  );

  const finalNormalChancePercent = clamp(100 - finalSpecialChancePercent, 0, 100);

  const masterySuccessBonusPercent = mastery * 0.3;

  const finalSuccessChancePercent = clamp(
    recipe.baseSuccessChancePercent + masterySuccessBonusPercent,
    0,
    100,
  );

  /**
   * -------------------------------------------------------
   * 3) 제작 시간
   * -------------------------------------------------------
   */
  const dexterityTimeReductionSeconds =
    0.2 * dexterity * (1 - additionalCookTimeReductionPercent / 100);

  const afterDexterityCraftTime = Math.max(
    1,
    recipe.baseCraftTimeSeconds - dexterityTimeReductionSeconds,
  );

  const preparationMasterReductionPercent =
    PREPARATION_MASTER_REDUCTION_PERCENT[preparationMaster] ?? 0;

  const finalCraftTimeSeconds = Math.max(
    0.1,
    afterDexterityCraftTime * (1 - preparationMasterReductionPercent / 100),
  );

  /**
   * -------------------------------------------------------
   * 4) 액티브 스킬 기대값
   * -------------------------------------------------------
   *
   * 즉시 완성:
   * - 발동 시 해당 1회 제작 시간이 0초
   * - 기대 시간 = 기본시간 * (1 - 발동확률)
   *
   * 연회 준비:
   * - 발동 시 추가 제작 횟수만큼 더 제작
   * - 추가 제작 시간은 0초
   * - 기대 제작 횟수 = 1 + (발동확률 * 추가 제작 횟수)
   *
   * 예:
   * - 추가 제작 횟수 3, 발동확률 42%
   * -> 기대 추가 제작 = 0.42 * 3 = 1.26회
   * -> 기대 총 제작 = 2.26회
   */
  const instantCompletionProcChancePercent = useInstantCompletion
    ? getInstantCompletionProcChancePercent(instantCompletion)
    : 0;

  const banquetPreparationProcChancePercent = useBanquetPreparation
    ? getBanquetPreparationProcChancePercent(banquetPreparation)
    : 0;

  const banquetPreparationExtraCraftCount = useBanquetPreparation
    ? getBanquetPreparationExtraCraftCount(banquetPreparation)
    : 0;

  const instantCompletionChanceRatio = instantCompletionProcChancePercent / 100;
  const banquetPreparationChanceRatio = banquetPreparationProcChancePercent / 100;
  const successChanceRatio = finalSuccessChancePercent / 100;

  const expectedActionTimeSeconds =
    finalCraftTimeSeconds * (1 - instantCompletionChanceRatio);

  const expectedCraftCountPerAction =
    1 + banquetPreparationChanceRatio * banquetPreparationExtraCraftCount;

  const expectedSuccessfulCraftCountPerAction =
    expectedCraftCountPerAction * successChanceRatio;

  /**
   * -------------------------------------------------------
   * 5) 희귀 재료 효과
   * -------------------------------------------------------
   */
  const balanceOfTasteBonusPercent =
    BALANCE_OF_TASTE_DURATION_BONUS_PERCENT[balanceOfTaste] ?? 0;

  const selectedRareIngredients = recipe.ingredients.filter(
    (ingredient) => input.rareIngredientFlags[ingredient.id] === true,
  );

  const selectedRareIngredientCount = selectedRareIngredients.reduce(
    (sum, ingredient) => sum + ingredient.quantity,
    0,
  );

  let rareIngredientDurationBonusSeconds = 0;
  const rareEffectSummaryLines: string[] = [];

  for (const rule of recipe.rareBonusRules) {
    const matchedCount = selectedRareIngredients.reduce((sum, ingredient) => {
      if (rule.matchGroup === "any") {
        return sum + ingredient.quantity;
      }

      return ingredient.rareBonusGroup === rule.matchGroup
        ? sum + ingredient.quantity
        : sum;
    }, 0);

    if (matchedCount <= 0) continue;

    const amount = (rule.amountPerIngredient ?? 0) * matchedCount;
    const durationBonus =
      (rule.durationBonusSecondsPerIngredient ?? 0) * matchedCount;

    rareIngredientDurationBonusSeconds += durationBonus;

    if (rule.bonusType === "stat" && amount > 0) {
      rareEffectSummaryLines.push(
        `희귀 재료 보너스: ${rule.label} +${amount}`,
      );
    }

    if (rule.bonusType === "recovery" && amount > 0) {
      rareEffectSummaryLines.push(
        `희귀 재료 보너스: ${rule.label} +${amount}`,
      );
    }

    if (rule.bonusType === "durationOnly" && durationBonus > 0) {
      rareEffectSummaryLines.push(
        `희귀 재료 보너스: 지속시간 +${durationBonus}초`,
      );
    } else if (durationBonus > 0 && rule.bonusType !== "durationOnly") {
      rareEffectSummaryLines.push(
        `희귀 재료 보너스: 지속시간 +${durationBonus}초`,
      );
    }
  }

  const finalDurationSeconds =
    recipe.baseDurationSeconds == null
      ? null
      : recipe.baseDurationSeconds *
          (1 + balanceOfTasteBonusPercent / 100) +
        rareIngredientDurationBonusSeconds;

  /**
   * -------------------------------------------------------
   * 6) 수익 기대값
   * -------------------------------------------------------
   */
  const expectedRevenuePerCraft =
    successChanceRatio *
    ((finalNormalChancePercent / 100) * input.prices.normalDishPrice +
      (finalSpecialChancePercent / 100) * input.prices.specialDishPrice);

  const expectedRevenuePerAction =
    expectedRevenuePerCraft * expectedCraftCountPerAction;

  const expectedNetProfitPerCraft =
    expectedRevenuePerCraft - ingredientCostPerCraft;

  const expectedNetProfitPerAction =
    expectedRevenuePerAction -
    ingredientCostPerCraft * expectedCraftCountPerAction;

  const expectedNetProfitPerHour =
    expectedActionTimeSeconds > 0
      ? expectedNetProfitPerAction * (3600 / expectedActionTimeSeconds)
      : 0;

  /**
   * -------------------------------------------------------
   * 7) 경험치 기대값
   * -------------------------------------------------------
   * - 경험치는 사용자 입력값 유지
   * - 성공한 제작만 경험치를 준다고 가정
   */
  const experiencePerSuccessfulCraft = Math.max(
    0,
    input.experiencePerSuccessfulCraft,
  );

  const expectedExperiencePerAction =
    experiencePerSuccessfulCraft * expectedSuccessfulCraftCountPerAction;

  const expectedExperiencePerHour =
    expectedActionTimeSeconds > 0
      ? expectedExperiencePerAction * (3600 / expectedActionTimeSeconds)
      : 0;

  return {
    recipeName: recipe.name,
    recipeTierLabel: recipe.tierLabel,

    ingredientCostPerCraft: round(ingredientCostPerCraft, 2),

    baseSpecialChancePercent: round(recipe.baseSpecialChancePercent, 2),
    codexGradeUpChancePercent: round(cookingGradeUpChance, 2),
    dexterityGradeUpChancePercent: round(dexterityGradeUpChancePercent, 2),
    gourmetGradeUpChancePercent: round(gourmetGradeUpChancePercent, 2),
    finalSpecialChancePercent: round(finalSpecialChancePercent, 2),
    finalNormalChancePercent: round(finalNormalChancePercent, 2),

    baseSuccessChancePercent: round(recipe.baseSuccessChancePercent, 2),
    masterySuccessBonusPercent: round(masterySuccessBonusPercent, 2),
    finalSuccessChancePercent: round(finalSuccessChancePercent, 2),

    baseCraftTimeSeconds: round(recipe.baseCraftTimeSeconds, 2),
    dexterityTimeReductionSeconds: round(dexterityTimeReductionSeconds, 2),
    preparationMasterReductionPercent: round(
      preparationMasterReductionPercent,
      2,
    ),
    additionalCookTimeReductionPercent: round(
      additionalCookTimeReductionPercent,
      2,
    ),
    finalCraftTimeSeconds: round(finalCraftTimeSeconds, 2),

    useInstantCompletion,
    useBanquetPreparation,
    instantCompletionProcChancePercent: round(
      instantCompletionProcChancePercent,
      2,
    ),
    banquetPreparationProcChancePercent: round(
      banquetPreparationProcChancePercent,
      2,
    ),
    expectedActionTimeSeconds: round(expectedActionTimeSeconds, 2),
    expectedCraftCountPerAction: round(expectedCraftCountPerAction, 4),
    expectedSuccessfulCraftCountPerAction: round(
      expectedSuccessfulCraftCountPerAction,
      4,
    ),

    baseDurationSeconds: recipe.baseDurationSeconds,
    balanceOfTasteBonusPercent: round(balanceOfTasteBonusPercent, 2),
    rareIngredientDurationBonusSeconds: round(
      rareIngredientDurationBonusSeconds,
      2,
    ),
    finalDurationSeconds:
      finalDurationSeconds == null ? null : round(finalDurationSeconds, 2),

    selectedRareIngredientCount,
    rareEffectSummaryLines,

    expectedRevenuePerCraft: round(expectedRevenuePerCraft, 2),
    expectedRevenuePerAction: round(expectedRevenuePerAction, 2),
    expectedNetProfitPerCraft: round(expectedNetProfitPerCraft, 2),
    expectedNetProfitPerAction: round(expectedNetProfitPerAction, 2),
    expectedNetProfitPerHour: round(expectedNetProfitPerHour, 2),

    experiencePerSuccessfulCraft: round(experiencePerSuccessfulCraft, 2),
    expectedExperiencePerAction: round(expectedExperiencePerAction, 2),
    expectedExperiencePerHour: round(expectedExperiencePerHour, 2),
  };
}
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
 *    = 기본 확률 + 요리 등급업 확률 + (0.1 * 손재주) + 미식가 보정
 *
 * 2) 요리 속도
 *    = 기본 속도 - (0.2 * 손재주) * (1 - 조리 단축 / 100)
 *    이후 손질 달인은 별도 곱연산으로 추가 감소
 *
 * 3) 섭취 유지 시간
 *    = 기본 시간 * (1 + 음식 효과연장 / 100)
 *    이후 맛의 균형은 별도 곱연산으로 추가 증가
 *
 * 4) 요리 성공 확률
 *    = 기본 확률 + (0.3 * 노련함)
 *
 * 5) 희귀 재료 보너스
 *    - 레시피별 규칙에 따라 효과/지속시간 증가
 *    - 현재 v1은 "희귀 재료 라인 1개당"으로 계산
 */

/**
 * -------------------------------------------------------
 * 스킬 테이블
 * -------------------------------------------------------
 * 위키는 정성 설명만 있고 레벨별 수치표는 공개하지 않으므로,
 * 아래 표는 프로젝트 내부 계산용 상수로 분리.
 * 나중에 실측값을 알게 되면 여기만 수정하면 됨.
 */

const PREPARATION_MASTER_REDUCTION_PERCENT: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 12, 12: 13, 13: 15, 14: 16, 15: 18, 16: 19, 17: 21, 18: 22, 19: 24, 20: 25,
  21: 28, 22: 30, 23: 33, 24: 35, 25: 38, 26: 40, 27: 43, 28: 45, 29: 48, 30: 50,
};

const BALANCE_OF_TASTE_DURATION_BONUS_PERCENT: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 12, 12: 14, 13: 16, 14: 18, 15: 20, 16: 22, 17: 24, 18: 26, 19: 28, 20: 30,
  21: 34, 22: 38, 23: 42, 24: 46, 25: 50, 26: 54, 27: 58, 28: 62, 29: 66, 30: 70,
};

const GOURMET_GRADE_UP_BONUS_PERCENT: Record<number, number> = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 14, 14: 16, 15: 18, 16: 20, 17: 22, 18: 24, 19: 26, 20: 28,
  21: 31, 22: 34, 23: 37, 24: 40, 25: 43, 26: 46, 27: 49, 28: 52, 29: 56, 30: 60,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
    additionalFoodDurationBonusPercent,
  } = input.stats;

  const {
    preparationMaster,
    balanceOfTaste,
    gourmet,
  } = input.skills;

  const ingredientCostPerCraft = recipe.ingredients.reduce((sum, ingredient) => {
    const unitPrice = input.prices.ingredientUnitPrices[ingredient.id] ?? 0;
    return sum + unitPrice * ingredient.quantity;
  }, 0);

  const dexterityGradeUpChancePercent = dexterity * 0.1;
  const gourmetGradeUpChancePercent = GOURMET_GRADE_UP_BONUS_PERCENT[gourmet] ?? 0;

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
   * 손재주 기본 시간 감소
   */
  const dexterityTimeReductionSeconds =
    0.2 * dexterity * (1 - additionalCookTimeReductionPercent / 100);

  const afterDexterityCraftTime = Math.max(
    1,
    recipe.baseCraftTimeSeconds - dexterityTimeReductionSeconds,
  );

  /**
   * 손질 달인:
   * 위키 설명상 손재주 감소와 별도 곱연산 중첩
   */
  const preparationMasterReductionPercent =
    PREPARATION_MASTER_REDUCTION_PERCENT[preparationMaster] ?? 0;

  const finalCraftTimeSeconds = Math.max(
    0.1,
    afterDexterityCraftTime * (1 - preparationMasterReductionPercent / 100),
  );

  const balanceOfTasteBonusPercent =
    BALANCE_OF_TASTE_DURATION_BONUS_PERCENT[balanceOfTaste] ?? 0;

  /**
   * 희귀 재료 선택 개수
   * - 현재 v1에서는 "재료 라인 1개당" 카운트
   */
  const selectedRareIngredients = recipe.ingredients.filter(
    (ingredient) => input.rareIngredientFlags[ingredient.id] === true,
  );

  const selectedRareIngredientCount = selectedRareIngredients.length;

  let rareIngredientDurationBonusSeconds = 0;
  const rareEffectSummaryLines: string[] = [];

  for (const rule of recipe.rareBonusRules) {
    const matchedCount = selectedRareIngredients.filter((ingredient) => {
      if (rule.matchGroup === "any") return true;
      return ingredient.rareBonusGroup === rule.matchGroup;
    }).length;

    if (matchedCount <= 0) continue;

    const amount =
      (rule.amountPerIngredient ?? 0) * matchedCount;

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
      : (
          recipe.baseDurationSeconds *
          (1 + additionalFoodDurationBonusPercent / 100) *
          (1 + balanceOfTasteBonusPercent / 100)
        ) + rareIngredientDurationBonusSeconds;

  const expectedRevenuePerCraft =
    (finalSuccessChancePercent / 100) *
    (
      (finalNormalChancePercent / 100) * input.prices.normalDishPrice +
      (finalSpecialChancePercent / 100) * input.prices.specialDishPrice
    );

  const expectedNetProfitPerCraft =
    expectedRevenuePerCraft - ingredientCostPerCraft;

  const expectedNetProfitPerHour =
    finalCraftTimeSeconds > 0
      ? expectedNetProfitPerCraft * (3600 / finalCraftTimeSeconds)
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
    preparationMasterReductionPercent: round(preparationMasterReductionPercent, 2),
    additionalCookTimeReductionPercent: round(additionalCookTimeReductionPercent, 2),
    finalCraftTimeSeconds: round(finalCraftTimeSeconds, 2),

    baseDurationSeconds: recipe.baseDurationSeconds,
    balanceOfTasteBonusPercent: round(balanceOfTasteBonusPercent, 2),
    additionalFoodDurationBonusPercent: round(additionalFoodDurationBonusPercent, 2),
    rareIngredientDurationBonusSeconds: round(rareIngredientDurationBonusSeconds, 2),
    finalDurationSeconds:
      finalDurationSeconds == null ? null : round(finalDurationSeconds, 2),

    selectedRareIngredientCount,
    rareEffectSummaryLines,

    expectedRevenuePerCraft: round(expectedRevenuePerCraft, 2),
    expectedNetProfitPerCraft: round(expectedNetProfitPerCraft, 2),
    expectedNetProfitPerHour: round(expectedNetProfitPerHour, 2),
  };
}
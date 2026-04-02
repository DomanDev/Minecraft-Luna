// src/lib/cooking/calc.ts

import { getCookingRecipe } from "./recipes";
import type {
  CookingCalculationInput,
  CookingCalculationResult,
} from "./types";
import {
  BALANCE_OF_TASTE_DURATION_BONUS,
  BANQUET_PREPARATION_TABLE,
  COOKING_SUCCESS_RATE_BASE,
  COOKING_SUCCESS_RATE_PER_MASTERY,
  DEXTERITY_SPECIAL_CHANCE_PER_POINT,
  DEXTERITY_TIME_REDUCTION_PER_POINT,
  GOURMET_SPECIAL_CHANCE,
  INSTANT_COMPLETION_TABLE,
  PREPARATION_MASTER_TIME_REDUCTION,
} from "./skillTables";

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateCooking(
  input: CookingCalculationInput
): CookingCalculationResult {
  const recipe = getCookingRecipe(input.environment.recipeId);

  const { mastery, dexterity, cookingGradeUpChance } = input.stats;
  const {
    preparationMaster,
    balanceOfTaste,
    gourmet,
    instantCompletion,
    banquetPreparation,
  } = input.skills;
  const { useBanquetPreparation } = input.environment;

  const gourmetSpecialChancePercent =
    GOURMET_SPECIAL_CHANCE[gourmet] ?? 0;
  const codexSpecialChancePercent = cookingGradeUpChance;
  const dexteritySpecialChancePercent =
    dexterity * DEXTERITY_SPECIAL_CHANCE_PER_POINT;

  const totalSpecialChancePercent = clamp(
    gourmetSpecialChancePercent +
      codexSpecialChancePercent +
      dexteritySpecialChancePercent,
    0,
    95
  );
  const totalNormalChancePercent = 100 - totalSpecialChancePercent;

  const masterySuccessRatePercent = clamp(
    COOKING_SUCCESS_RATE_BASE +
      mastery * COOKING_SUCCESS_RATE_PER_MASTERY,
    0,
    100
  );

  const ingredientCostPerCraft = recipe.ingredients.reduce((sum, ingredient) => {
    const unitPrice = input.prices.ingredientUnitPrices[ingredient.id] ?? 0;
    return sum + unitPrice * ingredient.quantity;
  }, 0);

  const balanceDurationBonusPercent =
    BALANCE_OF_TASTE_DURATION_BONUS[balanceOfTaste] ?? 0;
  const preparationTimeReductionPercent =
    PREPARATION_MASTER_TIME_REDUCTION[preparationMaster] ?? 0;

  const dexterityTimeReductionPercent = clamp(
    dexterity * DEXTERITY_TIME_REDUCTION_PER_POINT,
    0,
    80
  );

  const relativeCookTimeMultiplier =
    (1 - dexterityTimeReductionPercent / 100) *
    (1 - preparationTimeReductionPercent / 100);

  const relativeCookTimeReductionPercent = clamp(
    (1 - relativeCookTimeMultiplier) * 100,
    0,
    95
  );

  const banquetData =
    BANQUET_PREPARATION_TABLE[banquetPreparation] ??
    BANQUET_PREPARATION_TABLE[0];

  const banquetChancePercent = useBanquetPreparation
    ? banquetData.chancePercent
    : 0;

  const banquetExtraCount = useBanquetPreparation
    ? banquetData.extraCount
    : 0;

  /**
   * 해석:
   * - 연회 준비가 켜져 있지 않으면 1회 제작
   * - 켜져 있으면 확률 * 추가 횟수 만큼 기대 제작량 증가
   */
  const expectedOutputMultiplier =
    (masterySuccessRatePercent / 100) *
    (1 + (banquetChancePercent / 100) * banquetExtraCount);

  const expectedNormalCount =
    expectedOutputMultiplier * (totalNormalChancePercent / 100);

  const expectedSpecialCount =
    expectedOutputMultiplier * (totalSpecialChancePercent / 100);

  const expectedTotalOutputCount =
    expectedNormalCount + expectedSpecialCount;

  const expectedRevenuePerCraft =
    expectedNormalCount * input.prices.normalDishPrice +
    expectedSpecialCount * input.prices.specialDishPrice;

  const expectedNetProfitPerCraft =
    expectedRevenuePerCraft - ingredientCostPerCraft;

  const baseBuffDurationSeconds = recipe.baseBuffDurationSeconds;
  const finalBuffDurationSeconds =
    baseBuffDurationSeconds == null
      ? null
      : baseBuffDurationSeconds * (1 + balanceDurationBonusPercent / 100);

  const instantData =
    INSTANT_COMPLETION_TABLE[instantCompletion] ??
    INSTANT_COMPLETION_TABLE[0];

  return {
    intermediate: {
      recipeName: recipe.name,
      recipeTierLabel: recipe.tierLabel,
      ingredientCostPerCraft: round(ingredientCostPerCraft),

      gourmetSpecialChancePercent: round(gourmetSpecialChancePercent),
      codexSpecialChancePercent: round(codexSpecialChancePercent),
      dexteritySpecialChancePercent: round(dexteritySpecialChancePercent),
      masterySuccessRatePercent: round(masterySuccessRatePercent),
      dexterityTimeReductionPercent: round(dexterityTimeReductionPercent),

      banquetChancePercent: round(banquetChancePercent),
      banquetExtraCount,
      balanceDurationBonusPercent: round(balanceDurationBonusPercent),
      preparationTimeReductionPercent: round(preparationTimeReductionPercent),
      instantCompletionChancePercent: round(instantData.chancePercent),

      totalSpecialChancePercent: round(totalSpecialChancePercent),
      totalNormalChancePercent: round(totalNormalChancePercent),
      expectedOutputMultiplier: round(expectedOutputMultiplier),
      relativeCookTimeReductionPercent: round(relativeCookTimeReductionPercent),
      relativeCookTimeMultiplier: round(relativeCookTimeMultiplier),

      baseBuffDurationSeconds,
      finalBuffDurationSeconds:
        finalBuffDurationSeconds == null
          ? null
          : round(finalBuffDurationSeconds),
    },

    expectedNormalCount: round(expectedNormalCount),
    expectedSpecialCount: round(expectedSpecialCount),
    expectedTotalOutputCount: round(expectedTotalOutputCount),

    expectedRevenuePerCraft: round(expectedRevenuePerCraft),
    expectedNetProfitPerCraft: round(expectedNetProfitPerCraft),
  };
}
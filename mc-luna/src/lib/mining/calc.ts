import { getMiningRecipe } from "./recipes";
import type { MiningCalculationInput, MiningCalculationResult } from "./types";

function roundDexterity(value: number): number {
  return Math.max(0, Math.round(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 허름한 화로 재련 시간
 *
 * 현재 계산 기준:
 * - 손재주 1당 제작 시간 0.1초 감소
 * - 최소 0.1초 아래로는 내려가지 않도록 보정
 *
 * 예:
 * - 손재주 0  -> 15.0초
 * - 손재주 2  -> 14.8초
 * - 손재주 24 -> 12.6초
 */
function getFurnaceCraftTimeSeconds(dexterity: number): number {
  const safeDex = Math.max(0, dexterity);
  return Math.max(0.1, 15 - safeDex * 0.1);
}

/**
 * 벨리움 합성 시간
 *
 * 사용자가 직접 확인한 실측값:
 * - 손재주 0  -> 60 / 90
 * - 손재주 2  -> 59.7 / 89.7
 * - 손재주 24 -> 56.4 / 86.4
 *
 * 즉, 손재주 1당 0.15초 감소로 정확히 맞는다.
 */
function getSynthesisCraftTimeSeconds(
  baseCraftTimeSeconds: number,
  dexterity: number,
): number {
  return Math.max(0.1, baseCraftTimeSeconds - dexterity * 0.15);
}

export function calculateMining(
  input: MiningCalculationInput,
): MiningCalculationResult {
  const recipe = getMiningRecipe(input.recipeId);
  const roundedDex = roundDexterity(input.dexterity);

  const ingredientCostPerCraft = recipe.ingredients.reduce((sum, ingredient) => {
    const unitPrice =
      input.prices.ingredientUnitPrices[
        `${ingredient.itemKey}:${ingredient.grade}`
      ] ?? 0;

    return sum + unitPrice * ingredient.quantity;
  }, 0);

  if (recipe.kind === "furnace") {
    const baseWeights = recipe.furnaceBaseWeights!;

    /**
     * 실측 기준:
     * - 일반: 변화 없음
     * - 고급: + 1 * 손재주
     * - 희귀: + 1.5 * 손재주
     *
     * 소수점은 반올림되는 것으로 보인다고 했으므로
     * 각 보정값은 Math.round(...) 적용
     */
    const normalWeight = baseWeights.normal;
    const advancedWeight = baseWeights.advanced + Math.round(input.dexterity * 1);
    const rareWeight = baseWeights.rare + Math.round(input.dexterity * 1.5);
    const totalWeight = normalWeight + advancedWeight + rareWeight;

    const normalChancePercent = (normalWeight / totalWeight) * 100;
    const advancedChancePercent = (advancedWeight / totalWeight) * 100;
    const rareChancePercent = (rareWeight / totalWeight) * 100;

    const normalPrice =
      input.prices.resultPrices[`${recipe.resultItemKey}:normal`] ?? 0;
    const advancedPrice =
      input.prices.resultPrices[`${recipe.resultItemKey}:advanced`] ?? 0;
    const rarePrice =
      input.prices.resultPrices[`${recipe.resultItemKey}:rare`] ?? 0;

    const expectedRevenuePerCraft =
      (normalChancePercent / 100) * normalPrice +
      (advancedChancePercent / 100) * advancedPrice +
      (rareChancePercent / 100) * rarePrice;

    const expectedNetProfitPerCraft =
      expectedRevenuePerCraft - ingredientCostPerCraft;

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeKind: recipe.kind,
      dexterity: input.dexterity,
      roundedDexterity: roundedDex,
      baseCraftTimeSeconds: recipe.baseCraftTimeSeconds,
      finalCraftTimeSeconds: getFurnaceCraftTimeSeconds(input.dexterity),
      ingredientCostPerCraft,
      furnace: {
        baseSuccessChancePercent: 100,
        normalWeight,
        advancedWeight,
        rareWeight,
        totalWeight,
        normalChancePercent,
        advancedChancePercent,
        rareChancePercent,
        expectedRevenuePerCraft,
        expectedNetProfitPerCraft,
      },
    };
  }

  /**
   * 합성 성공률 실측 기준:
   * - 손재주 2   -> +0.16
   * - 손재주 2.5 -> round(2.5)=3 -> +0.24
   * - 손재주 24  -> +1.92
   *
   * 따라서:
   * finalSuccess = baseSuccess + Math.round(손재주) * 0.08
   */
  const baseSuccessChancePercent = recipe.synthesisBaseSuccessPercent ?? 0;
  const dexteritySuccessBonusPercent = roundedDex * 0.08;
  const finalSuccessChancePercent = clamp(
    baseSuccessChancePercent + dexteritySuccessBonusPercent,
    0,
    100,
  );

  const resultPrice =
    input.prices.resultPrices[`${recipe.resultItemKey}:single`] ?? 0;

  const expectedRevenuePerCraft =
    (finalSuccessChancePercent / 100) * resultPrice;
  const expectedNetProfitPerCraft =
    expectedRevenuePerCraft - ingredientCostPerCraft;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    recipeKind: recipe.kind,
    dexterity: input.dexterity,
    roundedDexterity: roundedDex,
    baseCraftTimeSeconds: recipe.baseCraftTimeSeconds,
    finalCraftTimeSeconds: getSynthesisCraftTimeSeconds(
      recipe.baseCraftTimeSeconds,
      input.dexterity,
    ),
    ingredientCostPerCraft,
    synthesis: {
      baseSuccessChancePercent,
      dexteritySuccessBonusPercent,
      finalSuccessChancePercent,
      expectedRevenuePerCraft,
      expectedNetProfitPerCraft,
    },
  };
}
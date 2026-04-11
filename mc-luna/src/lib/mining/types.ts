import type { MiningRecipeId } from "./recipes";

export type MiningCalculationInput = {
  recipeId: MiningRecipeId;
  dexterity: number;
  prices: {
    ingredientUnitPrices: Record<string, number>;
    resultPrices: Record<string, number>;
  };
};

export type MiningCalculationResult = {
  recipeId: MiningRecipeId;
  recipeName: string;
  recipeKind: "furnace" | "synthesis";

  dexterity: number;
  roundedDexterity: number;

  baseCraftTimeSeconds: number;
  finalCraftTimeSeconds: number;

  ingredientCostPerCraft: number;

  furnace?: {
    baseSuccessChancePercent: number;

    normalWeight: number;
    advancedWeight: number;
    rareWeight: number;
    totalWeight: number;

    normalChancePercent: number;
    advancedChancePercent: number;
    rareChancePercent: number;

    expectedRevenuePerCraft: number;
    expectedNetProfitPerCraft: number;
  };

  synthesis?: {
    baseSuccessChancePercent: number;
    dexteritySuccessBonusPercent: number;
    finalSuccessChancePercent: number;

    expectedRevenuePerCraft: number;
    expectedNetProfitPerCraft: number;
  };
};
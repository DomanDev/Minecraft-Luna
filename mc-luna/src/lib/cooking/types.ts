export type CookingRecipeId =
  | "ssambap"
  | "cornJeon"
  | "jeongol"
  | "radishJorim"
  | "gazpacho"
  | "cornJuice"
  | "radishJuice"
  | "bouillabaisse"
  | "cioppino"
  | "paella"
  | "ceviche"
  | "pepes"
  | "seafoodGrillPlatter"
  | "teriyaki"
  | "escabeche"
  | "yangjangpi";

export interface CookingIngredient {
  id: string;
  name: string;
  quantity: number;
}

export interface CookingRecipe {
  id: CookingRecipeId;
  name: string;
  tierLabel: "일반 요리" | "고급 요리" | "주스";
  description: string;
  baseDurationSeconds: number | null;
  baseCraftTimeSeconds: number;
  baseSuccessChancePercent: number;
  baseSpecialChancePercent: number;
  ingredients: CookingIngredient[];
}

export interface CookingStats {
  mastery: number;
  dexterity: number;
  cookingGradeUpChance: number;
  additionalCookTimeReductionPercent: number;
  additionalFoodDurationBonusPercent: number;
}

export interface CookingSkills {
  preparationMaster: number;
  balanceOfTaste: number;
  gourmet: number;
  instantCompletion: number;
  banquetPreparation: number;
}

export interface CookingPrices {
  normalDishPrice: number;
  specialDishPrice: number;
  ingredientUnitPrices: Record<string, number>;
}

export interface CookingCalculationInput {
  recipeId: CookingRecipeId;
  stats: CookingStats;
  skills: CookingSkills;
  prices: CookingPrices;
}

export interface CookingCalculationResult {
  recipeName: string;
  recipeTierLabel: string;

  ingredientCostPerCraft: number;

  baseSpecialChancePercent: number;
  codexGradeUpChancePercent: number;
  dexterityGradeUpChancePercent: number;
  gourmetGradeUpChancePercent: number;
  finalSpecialChancePercent: number;
  finalNormalChancePercent: number;

  baseSuccessChancePercent: number;
  masterySuccessBonusPercent: number;
  finalSuccessChancePercent: number;

  baseCraftTimeSeconds: number;
  dexterityTimeReductionSeconds: number;
  preparationMasterReductionPercent: number;
  additionalCookTimeReductionPercent: number;
  finalCraftTimeSeconds: number;

  baseDurationSeconds: number | null;
  balanceOfTasteBonusPercent: number;
  additionalFoodDurationBonusPercent: number;
  finalDurationSeconds: number | null;

  expectedRevenuePerCraft: number;
  expectedNetProfitPerCraft: number;
  expectedNetProfitPerHour: number;
}
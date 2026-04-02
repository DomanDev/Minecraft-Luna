// src/lib/cooking/types.ts

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
  tierLabel: "일반 요리" | "고급 요리";
  description: string;
  baseBuffDurationSeconds: number | null;
  ingredients: CookingIngredient[];
}

export interface CookingStats {
  /** 노련함 */
  mastery: number;
  /** 손재주 */
  dexterity: number;
  /** 도감 - 요리 등급업 확률 */
  cookingGradeUpChance: number;
}

export interface CookingSkills {
  /** 손질 달인 */
  preparationMaster: number;
  /** 맛의 균형 */
  balanceOfTaste: number;
  /** 미식가 */
  gourmet: number;
  /** 즉시 완성 */
  instantCompletion: number;
  /** 연회 준비 */
  banquetPreparation: number;
}

export interface CookingEnvironment {
  recipeId: CookingRecipeId;
  useInstantCompletion: boolean;
  useBanquetPreparation: boolean;
}

export interface CookingPrices {
  /** 일반 결과물 시세 */
  normalDishPrice: number;
  /** 일품 결과물 시세 (v1에서는 은별/금별 통합 버킷) */
  specialDishPrice: number;
  /** 선택한 레시피 재료별 시세 */
  ingredientUnitPrices: Record<string, number>;
}

export interface CookingCalculationInput {
  stats: CookingStats;
  skills: CookingSkills;
  environment: CookingEnvironment;
  prices: CookingPrices;
}

export interface CookingIntermediateResult {
  recipeName: string;
  recipeTierLabel: string;
  ingredientCostPerCraft: number;

  /** 공개 수치 */
  gourmetSpecialChancePercent: number;
  codexSpecialChancePercent: number;
  banquetChancePercent: number;
  banquetExtraCount: number;
  balanceDurationBonusPercent: number;
  preparationTimeReductionPercent: number;
  instantCompletionChancePercent: number;

  /** 추정/튜닝용 수치 */
  dexteritySpecialChancePercent: number;
  masterySuccessRatePercent: number;
  dexterityTimeReductionPercent: number;

  totalSpecialChancePercent: number;
  totalNormalChancePercent: number;
  expectedOutputMultiplier: number;
  relativeCookTimeReductionPercent: number;
  relativeCookTimeMultiplier: number;

  baseBuffDurationSeconds: number | null;
  finalBuffDurationSeconds: number | null;
}

export interface CookingCalculationResult {
  intermediate: CookingIntermediateResult;

  expectedNormalCount: number;
  expectedSpecialCount: number;
  expectedTotalOutputCount: number;

  expectedRevenuePerCraft: number;
  expectedNetProfitPerCraft: number;
}
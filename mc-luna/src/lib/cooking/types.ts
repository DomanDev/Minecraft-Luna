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

export type CookingIngredientBonusGroup =
  | "any"
  | "fish"
  | "crop"
  | "fruit"
  | "seafood";

export type CookingRareBonusType = "stat" | "recovery" | "durationOnly";

export interface CookingIngredient {
  id: string;
  name: string;
  quantity: number;

  /**
   * 희귀 재료 선택 시 어떤 보너스 그룹으로 계산할지
   * - any: 모든 희귀 재료 공통
   * - fish/crop/fruit/seafood: 특정 유형만 카운트
   */
  rareBonusGroup?: CookingIngredientBonusGroup;
}

export interface CookingRareBonusRule {
  matchGroup: CookingIngredientBonusGroup;
  bonusType: CookingRareBonusType;

  /**
   * 예:
   * - 행운
   * - 감각
   * - 노련함
   * - 손재주
   * - 인내력
   * - 회복량
   */
  label: string;

  /**
   * 희귀 재료 1개(=실제 필요 개수 1개)당 증가량
   * 예: 토마토 x3 라인을 희귀로 체크하면 3개로 계산
   */
  amountPerIngredient?: number;

  /**
   * 희귀 재료 1개(=실제 필요 개수 1개)당 추가 지속시간(초)
   * 예: 토마토 x3 라인을 희귀로 체크하면 3배 적용
   */
  durationBonusSecondsPerIngredient?: number;
}

export interface CookingRecipe {
  id: CookingRecipeId;
  name: string;
  tierLabel: "일반 요리" | "고급 요리" | "주스";
  description: string;

  /**
   * 버프형 요리는 지속시간이 있고
   * 주스류는 null 가능
   */
  baseDurationSeconds: number | null;
  baseCraftTimeSeconds: number;
  baseSuccessChancePercent: number;
  baseSpecialChancePercent: number;
  ingredients: CookingIngredient[];

  /**
   * 희귀 재료 보너스 규칙
   */
  rareBonusRules: CookingRareBonusRule[];
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

  /**
   * 재료별 희귀 재료 선택 여부
   * - true면 해당 재료 라인의 필요 수량 전체를 희귀 재료로 사용한다고 가정
   *   예: 토마토 x3 체크 -> 희귀 토마토 3개 사용
   */
  rareIngredientFlags: Record<string, boolean>;
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
  rareIngredientDurationBonusSeconds: number;
  finalDurationSeconds: number | null;

  /**
   * 희귀 재료 관련 표시용
   * - 실제 희귀 재료 개수 합계
   */
  selectedRareIngredientCount: number;

  rareEffectSummaryLines: string[];

  expectedRevenuePerCraft: number;
  expectedNetProfitPerCraft: number;
  expectedNetProfitPerHour: number;
}
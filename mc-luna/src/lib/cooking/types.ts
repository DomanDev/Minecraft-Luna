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

export type CookingIngredientSpecialChanceCategory =
  | "fish"
  | "crop"
  | "none";

/**
 * 요리 갈증 최소치 드롭다운 값
 *
 * 현재 정책:
 * - 우선 15 이상 유지 1개만 노출
 * - 패치노트 기준으로 15 이상일 때 일품 확률 +10% 반영
 * - 추후 서버 데이터가 더 확보되면 20/25 등 상위 구간을 확장할 수 있다.
 */
export type CookingThirstMin = 15;

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

  /**
   * 재료 등급(고급/희귀)에 따른 일품 확률 보정 계산용 분류
   *
   * 주의:
   * - 여기서 "fish"는 낚시/수산 재료 전체를 의미한다.
   *   (예: 물고기, 갑각류, 문어, 개구리 등)
   * - 여기서 "crop"은 농사 재료 전체를 의미한다.
   *   (예: 채소, 과일)
   * - "none"은 재료 등급 보정을 적용하지 않는 경우에 사용한다.
   */
  specialChanceCategory?: CookingIngredientSpecialChanceCategory;
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
   * 재료 등급(고급/희귀)에 따른 일품 확률 보정 적용 여부
   *
   * 예:
   * - 일반 요리 / 고급 요리: true
   * - 옥수수 착즙 주스 / 무 착즙 주스: false
   */
  usesIngredientGradeSpecialChanceAdjustment?: boolean;

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

  /**
   * 추가 조리 시간 감소
   * - 현재 프로젝트 내부에서 유지 중인 보정값
   */
  additionalCookTimeReductionPercent: number;
}

export interface CookingSkills {
  preparationMaster: number;
  balanceOfTaste: number;
  gourmet: number;

  /**
   * 액티브 스킬 레벨
   */
  instantCompletion: number;
  banquetPreparation: number;

  /**
   * 액티브 스킬 사용 여부
   * - 레벨이 있어도 체크하지 않으면 계산에 반영하지 않음
   */
  useInstantCompletion: boolean;
  useBanquetPreparation: boolean;
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
   * 1회 성공 요리 경험치
   *
   * 주의:
   * - 현재 공개 코드와 업로드된 파일에서는
   *   레시피별 정확한 경험치 테이블을 확인할 수 없으므로
   *   우선 계산기 입력값으로 둔다.
   * - 나중에 정확한 서버값을 확보하면
   *   recipes.ts 또는 별도 exp 테이블로 이동 가능하다.
   */
  experiencePerSuccessfulCraft: number;

  /**
   * 갈증 최소치 드롭다운 선택값
   *
   * 현재 정책:
   * - 15 이상 유지 시 일품 확률 +10%
   */
  thirstMin: CookingThirstMin;

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
  advancedFishIngredientTypeCount: number;
  advancedCropIngredientTypeCount: number;
  rareFishIngredientTypeCount: number;
  rareCropIngredientTypeCount: number;
  advancedIngredientPenaltyPercent: number;
  rareIngredientBonusPercent: number;
  ingredientGradeSpecialChanceAdjustmentPercent: number;
  selectedThirstMin: CookingThirstMin;
  thirstSpecialChanceBonusPercent: number;
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

  /**
   * 액티브 스킬 관련
   */
  useInstantCompletion: boolean;
  useBanquetPreparation: boolean;
  instantCompletionProcChancePercent: number;
  banquetPreparationProcChancePercent: number;
  /**
   * 액티브 스킬 반영 후 기대 재료 소모량
   * - 즉시 완성 발동 시 해당 action 전체 재료를 소모하지 않는다고 가정
   * - 따라서 연회 준비와 동시에 발동하면 추가 제작분까지 모두 무료 처리된다.
   */
  expectedConsumedCraftCountPerAction: number;
  expectedIngredientCostPerAction: number;
  expectedIngredientCostSavedPerAction: number;
  expectedActionTimeSeconds: number;
  expectedCraftCountPerAction: number;
  expectedSuccessfulCraftCountPerAction: number;

  baseDurationSeconds: number | null;
  balanceOfTasteBonusPercent: number;
  rareIngredientDurationBonusSeconds: number;
  finalDurationSeconds: number | null;

  /**
   * 희귀 재료 관련 표시용
   * - 실제 희귀 재료 개수 합계
   */
  selectedRareIngredientCount: number;

  rareEffectSummaryLines: string[];

  expectedRevenuePerCraft: number;
  expectedRevenuePerAction: number;
  expectedNetProfitPerCraft: number;
  expectedNetProfitPerAction: number;
  expectedNetProfitPerHour: number;

  /**
   * 경험치 계산
   */
  experiencePerSuccessfulCraft: number;
  expectedExperiencePerAction: number;
  expectedExperiencePerHour: number;
}
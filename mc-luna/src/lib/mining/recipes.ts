/**
 * =========================
 * 광부(재련) 레시피 정의
 * =========================
 *
 * 현재 페이지 명칭은 "채광"을 유지하지만,
 * 실제 계산 로직은 커스텀 주괴 재련/합성에 맞춘다.
 */

export type MiningRecipeId =
  | "mithril_ingot"
  | "argentite_ingot"
  | "vellium_ingot"
  | "sturdy_vellium"
  | "pure_vellium";

export type MiningIngredientGrade = "single" | "normal" | "advanced" | "rare";
export type MiningResultGrade = "normal" | "advanced" | "rare" | "single";

export type MiningRecipe = {
  id: MiningRecipeId;
  name: string;
  tierLabel: string;
  description: string;
  baseCraftTimeSeconds: number;

  /**
   * furnace:
   * - 항상 결과물 1개가 나오며
   * - 일반/고급/희귀 등급 확률이 존재
   *
   * synthesis:
   * - 성공 시 단일 결과물 1개
   * - 실패 확률 존재
   */
  kind: "furnace" | "synthesis";

  /**
   * 회색 정보 박스에 보여줄 기본 정보
   */
  baseInfoLines: string[];

  ingredients: {
    itemKey: string;
    name: string;
    quantity: number;
    grade: MiningIngredientGrade;
  }[];

  /**
   * 결과물 item key
   * - furnace: 등급형 결과물 1개 key
   * - synthesis: 단일 결과물 key
   */
  resultItemKey: string;
  resultName: string;
  resultGradeType: "triple" | "single";

  /**
   * furnace 기본 가중치
   * normal / advanced / rare
   */
  furnaceBaseWeights?: {
    normal: number;
    advanced: number;
    rare: number;
  };

  /**
   * synthesis 기본 성공률 (%)
   */
  synthesisBaseSuccessPercent?: number;
};

export const MINING_RECIPES: MiningRecipe[] = [
  {
    id: "mithril_ingot",
    name: "미스릴 주괴",
    tierLabel: "허름한 화로 재련",
    description:
      "미스릴 원석 3개와 마그마 블록 4개를 사용해 미스릴 주괴를 재련합니다.",
    baseCraftTimeSeconds: 15,
    kind: "furnace",
    baseInfoLines: [
      "재료: 미스릴 원석 3개 + 마그마 블록 4개",
      "기본 성공률: 100%",
      "기본 제작 시간: 15초",
      "기본 가중치: 일반 150 / 고급 30 / 희귀 15",
    ],
    ingredients: [
      { itemKey: "mithril_ore", name: "미스릴 원석", quantity: 3, grade: "single" },
      { itemKey: "magma_block", name: "마그마 블록", quantity: 4, grade: "single" },
    ],
    resultItemKey: "mithril_ingot",
    resultName: "미스릴 주괴",
    resultGradeType: "triple",
    furnaceBaseWeights: {
      normal: 150,
      advanced: 30,
      rare: 15,
    },
  },
  {
    id: "argentite_ingot",
    name: "아르젠타이트 주괴",
    tierLabel: "허름한 화로 재련",
    description:
      "아르젠타이트 원석 3개와 마그마 블록 4개를 사용해 아르젠타이트 주괴를 재련합니다.",
    baseCraftTimeSeconds: 15,
    kind: "furnace",
    baseInfoLines: [
      "재료: 아르젠타이트 원석 3개 + 마그마 블록 4개",
      "기본 성공률: 100%",
      "기본 제작 시간: 15초",
      "기본 가중치: 일반 150 / 고급 30 / 희귀 15",
    ],
    ingredients: [
      { itemKey: "argentite_ore", name: "아르젠타이트 원석", quantity: 3, grade: "single" },
      { itemKey: "magma_block", name: "마그마 블록", quantity: 4, grade: "single" },
    ],
    resultItemKey: "argentite_ingot",
    resultName: "아르젠타이트 주괴",
    resultGradeType: "triple",
    furnaceBaseWeights: {
      normal: 150,
      advanced: 30,
      rare: 15,
    },
  },
  {
    id: "vellium_ingot",
    name: "벨리움 주괴",
    tierLabel: "허름한 화로 재련",
    description:
      "벨리움 원석 3개와 마그마 블록 4개를 사용해 벨리움 주괴를 재련합니다.",
    baseCraftTimeSeconds: 15,
    kind: "furnace",
    baseInfoLines: [
      "재료: 벨리움 원석 3개 + 마그마 블록 4개",
      "기본 성공률: 100%",
      "기본 제작 시간: 15초",
      "기본 가중치: 일반 150 / 고급 30 / 희귀 15",
    ],
    ingredients: [
      { itemKey: "vellium_ore", name: "벨리움 원석", quantity: 3, grade: "single" },
      { itemKey: "magma_block", name: "마그마 블록", quantity: 4, grade: "single" },
    ],
    resultItemKey: "vellium_ingot",
    resultName: "벨리움 주괴",
    resultGradeType: "triple",
    furnaceBaseWeights: {
      normal: 150,
      advanced: 30,
      rare: 15,
    },
  },
  {
    id: "sturdy_vellium",
    name: "단단한 벨리움",
    tierLabel: "벨리움 합성",
    description:
      "고급 미스릴 주괴 + 고급 아르젠타이트 주괴 + 네더라이트 주괴를 사용해 단단한 벨리움을 합성합니다.",
    baseCraftTimeSeconds: 60,
    kind: "synthesis",
    baseInfoLines: [
      "재료: 고급 미스릴 주괴 1개 + 고급 아르젠타이트 주괴 1개 + 네더라이트 주괴 1개",
      "기본 성공률: 73%",
      "기본 제작 시간: 60초",
      "성공률과 제작 시간은 손재주의 영향을 받음",
    ],
    ingredients: [
      {
        itemKey: "mithril_ingot",
        name: "고급 미스릴 주괴",
        quantity: 1,
        grade: "advanced",
      },
      {
        itemKey: "argentite_ingot",
        name: "고급 아르젠타이트 주괴",
        quantity: 1,
        grade: "advanced",
      },
      {
        itemKey: "netherite_ingot",
        name: "네더라이트 주괴",
        quantity: 1,
        grade: "single",
      },
    ],
    resultItemKey: "sturdy_vellium",
    resultName: "단단한 벨리움",
    resultGradeType: "single",
    synthesisBaseSuccessPercent: 73,
  },
  {
    id: "pure_vellium",
    name: "순수한 벨리움",
    tierLabel: "벨리움 합성",
    description:
      "희귀 미스릴 주괴 + 희귀 아르젠타이트 주괴 + 네더라이트 주괴를 사용해 순수한 벨리움을 합성합니다.",
    baseCraftTimeSeconds: 90,
    kind: "synthesis",
    baseInfoLines: [
      "재료: 희귀 미스릴 주괴 1개 + 희귀 아르젠타이트 주괴 1개 + 네더라이트 주괴 1개",
      "기본 성공률: 46%",
      "기본 제작 시간: 90초",
      "성공률과 제작 시간은 손재주의 영향을 받음",
    ],
    ingredients: [
      {
        itemKey: "mithril_ingot",
        name: "희귀 미스릴 주괴",
        quantity: 1,
        grade: "rare",
      },
      {
        itemKey: "argentite_ingot",
        name: "희귀 아르젠타이트 주괴",
        quantity: 1,
        grade: "rare",
      },
      {
        itemKey: "netherite_ingot",
        name: "네더라이트 주괴",
        quantity: 1,
        grade: "single",
      },
    ],
    resultItemKey: "pure_vellium",
    resultName: "순수한 벨리움",
    resultGradeType: "single",
    synthesisBaseSuccessPercent: 46,
  },
];

export function getMiningRecipe(recipeId: MiningRecipeId): MiningRecipe {
  const recipe = MINING_RECIPES.find((item) => item.id === recipeId);

  if (!recipe) {
    throw new Error(`알 수 없는 광부(재련) 레시피입니다: ${recipeId}`);
  }

  return recipe;
}
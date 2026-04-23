import type { CookingRecipe, CookingRecipeId } from "./types";

/**
 * -------------------------------------------------------
 * 요리 기본값 정리 기준
 * -------------------------------------------------------
 * 1) 일반 요리 5종:
 *    - 희귀(=일품) 기본 확률 5%
 *    - 제작 시간 29.4초
 *    - 성공 확률 80%
 *
 * 2) 착즙 주스 2종:
 *    - 제작 시간 14.4초
 *    - 성공 확률 90%
 *
 * 3) 고급 요리 9종:
 *    - 희귀(=일품) 기본 확률 5%
 *    - 제작 시간 39.4초
 *    - 성공 확률 80%
 *
 * 4) 희귀 재료 보너스:
 *    - 사용자가 첨부한 인게임 이미지 기준으로 반영
 *    - "희귀 재료마다"는 현재 v1에서 "재료 라인 1개당"으로 처리
 *      (예: 토마토 x3 은 한 재료 라인으로 1회 카운트)
 */

export const COOKING_RECIPES: CookingRecipe[] = [
  {
    id: "ssambap",
    name: "쌈밥",
    tierLabel: "일반 요리",
    description: "행운 +2",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 29.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "miscFish", name: "잡어", quantity: 1, rareBonusGroup: "any" },
      { id: "lettuce", name: "상추", quantity: 2, rareBonusGroup: "any" },
      { id: "corn", name: "옥수수", quantity: 2, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "행운",
        amountPerIngredient: 3,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "cornJeon",
    name: "옥수수 전",
    tierLabel: "일반 요리",
    description: "감각 +4",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 29.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "sardine", name: "정어리", quantity: 1, rareBonusGroup: "any" },
      { id: "lettuce", name: "상추", quantity: 2, rareBonusGroup: "any" },
      { id: "corn", name: "옥수수", quantity: 2, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "감각",
        amountPerIngredient: 3,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "jeongol",
    name: "전골",
    tierLabel: "일반 요리",
    description: "손재주 +4",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 29.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "catfish", name: "메기", quantity: 1, rareBonusGroup: "any" },
      { id: "cabbage", name: "양배추", quantity: 2, rareBonusGroup: "any" },
      { id: "radish", name: "무", quantity: 2, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "노련함",
        amountPerIngredient: 4,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "radishJorim",
    name: "무조림",
    tierLabel: "일반 요리",
    description: "인내력 +10",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 29.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "carp", name: "잉어", quantity: 1, rareBonusGroup: "fish" },
      { id: "cabbage", name: "양배추", quantity: 2, rareBonusGroup: "crop" },
      { id: "radish", name: "무", quantity: 2, rareBonusGroup: "crop" },
    ],
    rareBonusRules: [
      {
        matchGroup: "fish",
        bonusType: "stat",
        label: "인내력",
        amountPerIngredient: 10,
        durationBonusSecondsPerIngredient: 200,
      },
      {
        matchGroup: "crop",
        bonusType: "stat",
        label: "인내력",
        amountPerIngredient: 5,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "gazpacho",
    name: "가스파초",
    tierLabel: "일반 요리",
    description: "노련함 +8",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 29.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "miscFish", name: "잡어", quantity: 1, rareBonusGroup: "any" },
      { id: "radish", name: "무", quantity: 2, rareBonusGroup: "any" },
      { id: "corn", name: "옥수수", quantity: 2, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "손재주",
        amountPerIngredient: 3,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "cornJuice",
    name: "옥수수 착즙 주스",
    tierLabel: "주스",
    description: "갈증 4 회복",
    baseDurationSeconds: null,
    baseCraftTimeSeconds: 14.4,
    baseSuccessChancePercent: 90,
    baseSpecialChancePercent: 0,
    ingredients: [
      { id: "corn", name: "옥수수", quantity: 1, rareBonusGroup: "any" },
      { id: "lettuce", name: "상추", quantity: 1, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "recovery",
        label: "회복량",
        amountPerIngredient: 3,
      },
    ],
  },
  {
    id: "radishJuice",
    name: "무 착즙 주스",
    tierLabel: "주스",
    description: "마나 10 회복",
    baseDurationSeconds: null,
    baseCraftTimeSeconds: 14.4,
    baseSuccessChancePercent: 90,
    baseSpecialChancePercent: 0,
    ingredients: [
      { id: "radish", name: "무", quantity: 2, rareBonusGroup: "any" },
      { id: "cabbage", name: "양배추", quantity: 2, rareBonusGroup: "any" },
    ],
    /**
     * 이전에 받은 이미지에서는 희귀 재료 추가 효과 문구가 확인되지 않아
     * 일단 v1에서는 미적용 처리.
     * 추후 인게임 문구 확인되면 여기만 수정하면 된다.
     */
    rareBonusRules: [],
  },
  {
    id: "bouillabaisse",
    name: "부야베스",
    tierLabel: "고급 요리",
    description: "되뿌리기 Lv.1, 수확의 손길 Lv.1",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "redSnapper", name: "적색통돔", quantity: 1, rareBonusGroup: "any" },
      { id: "anglerfish", name: "아귀", quantity: 1, rareBonusGroup: "any" },
      { id: "tomato", name: "토마토", quantity: 3, rareBonusGroup: "any" },
      { id: "pomegranate", name: "석류", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "durationOnly",
        label: "지속시간",
        durationBonusSecondsPerIngredient: 15,
      },
    ],
  },
  {
    id: "cioppino",
    name: "치오피노",
    tierLabel: "고급 요리",
    description: "떼낚시 Lv.1, 쌍걸이 Lv.1",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "tuna", name: "다랑어", quantity: 1, rareBonusGroup: "any" },
      { id: "lobster", name: "랍스터", quantity: 1, rareBonusGroup: "any" },
      { id: "tomato", name: "토마토", quantity: 3, rareBonusGroup: "any" },
      { id: "pineapple", name: "파인애플", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "durationOnly",
        label: "지속시간",
        durationBonusSecondsPerIngredient: 15,
      },
    ],
  },
  {
    id: "paella",
    name: "파에야",
    tierLabel: "고급 요리",
    description: "연회 준비 Lv.1, 즉시 완성 Lv.1",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "seaBass", name: "농어", quantity: 1, rareBonusGroup: "any" },
      { id: "mullet", name: "숭어", quantity: 1, rareBonusGroup: "any" },
      { id: "corn", name: "옥수수", quantity: 3, rareBonusGroup: "any" },
      { id: "tomato", name: "토마토", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "durationOnly",
        label: "지속시간",
        durationBonusSecondsPerIngredient: 15,
      },
    ],
  },
  {
    id: "ceviche",
    name: "세비체",
    tierLabel: "고급 요리",
    description: "폭발적인 채광 Lv.1, 광맥 탐지 Lv.1",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "blueTang", name: "블루탱", quantity: 1, rareBonusGroup: "any" },
      { id: "clownfish", name: "흰동가리", quantity: 1, rareBonusGroup: "any" },
      { id: "lemon", name: "레몬", quantity: 3, rareBonusGroup: "any" },
      { id: "strawberry", name: "딸기", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "durationOnly",
        label: "지속시간",
        durationBonusSecondsPerIngredient: 15,
      },
    ],
  },
  {
    id: "pepes",
    name: "페페스",
    tierLabel: "고급 요리",
    description: "행운 +8",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "sunfish", name: "개복치", quantity: 1, rareBonusGroup: "any" },
      { id: "stripedSeabream", name: "줄돔", quantity: 1, rareBonusGroup: "any" },
      { id: "swampFrog", name: "개구리", quantity: 1, rareBonusGroup: "any" },
      { id: "banana", name: "바나나", quantity: 3, rareBonusGroup: "any" },
      { id: "tomato", name: "토마토", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "행운",
        amountPerIngredient: 3,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "seafoodGrillPlatter",
    name: "해산물 그릴 플래터",
    tierLabel: "고급 요리",
    description: "감각 +8",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "mantaRay", name: "만타 가오리", quantity: 1, rareBonusGroup: "any" },
      { id: "octopus", name: "문어", quantity: 1, rareBonusGroup: "any" },
      { id: "pineapple", name: "파인애플", quantity: 3, rareBonusGroup: "any" },
      { id: "orange", name: "오렌지", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "감각",
        amountPerIngredient: 3,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "teriyaki",
    name: "데리야키",
    tierLabel: "고급 요리",
    description: "손재주 +8",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "salmon", name: "연어", quantity: 1, rareBonusGroup: "any" },
      { id: "sturgeon", name: "철갑상어", quantity: 1, rareBonusGroup: "any" },
      { id: "orange", name: "오렌지", quantity: 3, rareBonusGroup: "any" },
      { id: "pineapple", name: "파인애플", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "손재주",
        amountPerIngredient: 4,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "escabeche",
    name: "에스카베체",
    tierLabel: "고급 요리",
    description: "인내력 +5",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "pike", name: "강꼬치고기", quantity: 1, rareBonusGroup: "any" },
      { id: "goldfish", name: "금붕어", quantity: 1, rareBonusGroup: "any" },
      { id: "pomegranate", name: "석류", quantity: 3, rareBonusGroup: "any" },
      { id: "lemon", name: "레몬", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "인내력",
        amountPerIngredient: 5,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
  {
    id: "yangjangpi",
    name: "양장피",
    tierLabel: "고급 요리",
    description: "노련함 +10",
    baseDurationSeconds: 600,
    baseCraftTimeSeconds: 39.4,
    baseSuccessChancePercent: 80,
    baseSpecialChancePercent: 5,
    ingredients: [
      { id: "blueJellyfish", name: "푸른 해파리", quantity: 1, rareBonusGroup: "any" },
      { id: "eel", name: "뱀장어", quantity: 1, rareBonusGroup: "any" },
      { id: "cabbage", name: "양배추", quantity: 3, rareBonusGroup: "any" },
      { id: "radish", name: "무", quantity: 3, rareBonusGroup: "any" },
    ],
    rareBonusRules: [
      {
        matchGroup: "any",
        bonusType: "stat",
        label: "노련함",
        amountPerIngredient: 5,
        durationBonusSecondsPerIngredient: 200,
      },
    ],
  },
];

export function getCookingRecipe(recipeId: CookingRecipeId): CookingRecipe {
  return COOKING_RECIPES.find((recipe) => recipe.id === recipeId) ?? COOKING_RECIPES[0];
}
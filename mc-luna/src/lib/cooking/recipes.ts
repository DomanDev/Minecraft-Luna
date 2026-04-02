// src/lib/cooking/recipes.ts

import type { CookingRecipe } from "./types";

export const COOKING_RECIPES: CookingRecipe[] = [
  {
    id: "ssambap",
    name: "쌈밥",
    tierLabel: "일반 요리",
    description: "행운 +2",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "fish_misc", name: "잡어", quantity: 1 },
      { id: "lettuce", name: "상추", quantity: 2 },
      { id: "corn", name: "옥수수", quantity: 2 },
    ],
  },
  {
    id: "cornJeon",
    name: "옥수수 전",
    tierLabel: "일반 요리",
    description: "감각 +4",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "sardine", name: "정어리", quantity: 1 },
      { id: "lettuce", name: "상추", quantity: 2 },
      { id: "corn", name: "옥수수", quantity: 2 },
    ],
  },
  {
    id: "jeongol",
    name: "전골",
    tierLabel: "일반 요리",
    description: "손재주 +4",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "catfish", name: "메기", quantity: 1 },
      { id: "cabbage", name: "양배추", quantity: 2 },
      { id: "radish", name: "무", quantity: 2 },
    ],
  },
  {
    id: "radishJorim",
    name: "무조림",
    tierLabel: "일반 요리",
    description: "인내력 +10",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "carp", name: "잉어", quantity: 1 },
      { id: "cabbage", name: "양배추", quantity: 2 },
      { id: "radish", name: "무", quantity: 2 },
    ],
  },
  {
    id: "gazpacho",
    name: "가스파초",
    tierLabel: "일반 요리",
    description: "노련함 +8",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "fish_misc", name: "잡어", quantity: 1 },
      { id: "radish", name: "무", quantity: 2 },
      { id: "corn", name: "옥수수", quantity: 2 },
    ],
  },
  {
    id: "cornJuice",
    name: "옥수수 착즙 주스",
    tierLabel: "일반 요리",
    description: "갈증 4 회복",
    baseBuffDurationSeconds: null,
    ingredients: [
      { id: "corn", name: "옥수수", quantity: 1 },
      { id: "lettuce", name: "상추", quantity: 1 },
    ],
  },
  {
    id: "radishJuice",
    name: "무 착즙 주스",
    tierLabel: "일반 요리",
    description: "마나 10 회복",
    baseBuffDurationSeconds: null,
    ingredients: [
      { id: "radish", name: "무", quantity: 2 },
      { id: "cabbage", name: "양배추", quantity: 2 },
    ],
  },
  {
    id: "bouillabaisse",
    name: "부야베스",
    tierLabel: "고급 요리",
    description: "되뿌리기 Lv.1, 수확의 손길 Lv.1",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "red_snapper", name: "적색통돔", quantity: 1 },
      { id: "anglerfish", name: "아귀", quantity: 1 },
      { id: "tomato", name: "토마토", quantity: 3 },
      { id: "pomegranate", name: "석류", quantity: 3 },
    ],
  },
  {
    id: "cioppino",
    name: "치오피노",
    tierLabel: "고급 요리",
    description: "떼낚시 Lv.1, 쌍걸이 Lv.1",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "tuna", name: "다랑어", quantity: 1 },
      { id: "lobster", name: "랍스터", quantity: 1 },
      { id: "tomato", name: "토마토", quantity: 3 },
      { id: "pineapple", name: "파인애플", quantity: 3 },
    ],
  },
  {
    id: "paella",
    name: "파에야",
    tierLabel: "고급 요리",
    description: "연회 준비 Lv.1, 즉시 완성 Lv.1",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "sea_bass", name: "농어", quantity: 1 },
      { id: "mullet", name: "숭어", quantity: 1 },
      { id: "corn", name: "옥수수", quantity: 3 },
      { id: "tomato", name: "토마토", quantity: 3 },
    ],
  },
  {
    id: "ceviche",
    name: "세비체",
    tierLabel: "고급 요리",
    description: "폭발적인 채광 Lv.1, 광맥 탐지 Lv.1",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "blue_tang", name: "블루탱", quantity: 1 },
      { id: "clownfish", name: "흰동가리", quantity: 1 },
      { id: "lemon", name: "레몬", quantity: 3 },
      { id: "strawberry", name: "딸기", quantity: 3 },
    ],
  },
  {
    id: "pepes",
    name: "페페스",
    tierLabel: "고급 요리",
    description: "행운 +8",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "sunfish", name: "개복치", quantity: 1 },
      { id: "striped_seabream", name: "줄돔", quantity: 1 },
      { id: "swamp_frog", name: "습지개구리", quantity: 1 },
      { id: "banana", name: "바나나", quantity: 3 },
      { id: "tomato", name: "토마토", quantity: 3 },
    ],
  },
  {
    id: "seafoodGrillPlatter",
    name: "해산물그릴플래터",
    tierLabel: "고급 요리",
    description: "감각 +8",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "manta_ray", name: "만타 가오리", quantity: 1 },
      { id: "octopus", name: "문어", quantity: 1 },
      { id: "pineapple", name: "파인애플", quantity: 3 },
      { id: "orange", name: "오렌지", quantity: 3 },
    ],
  },
  {
    id: "teriyaki",
    name: "데리야끼",
    tierLabel: "고급 요리",
    description: "손재주 +8",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "salmon", name: "연어", quantity: 1 },
      { id: "sturgeon", name: "철갑상어", quantity: 1 },
      { id: "orange", name: "오렌지", quantity: 3 },
      { id: "pineapple", name: "파인애플", quantity: 3 },
    ],
  },
  {
    id: "escabeche",
    name: "에스카베체",
    tierLabel: "고급 요리",
    description: "인내력 +15",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "pike", name: "강꼬치고기", quantity: 1 },
      { id: "goldfish", name: "금붕어", quantity: 1 },
      { id: "pomegranate", name: "석류", quantity: 3 },
      { id: "lemon", name: "레몬", quantity: 3 },
    ],
  },
  {
    id: "yangjangpi",
    name: "양장피",
    tierLabel: "고급 요리",
    description: "노련함 +10",
    baseBuffDurationSeconds: 600,
    ingredients: [
      { id: "blue_jellyfish", name: "푸른 해파리", quantity: 1 },
      { id: "eel", name: "뱀장어", quantity: 1 },
      { id: "cabbage", name: "양배추", quantity: 3 },
      { id: "radish", name: "무", quantity: 3 },
    ],
  },
];

export function getCookingRecipe(recipeId: string): CookingRecipe {
  return (
    COOKING_RECIPES.find((recipe) => recipe.id === recipeId) ?? COOKING_RECIPES[0]
  );
}
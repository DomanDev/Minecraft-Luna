import type { MarketPriceItem } from "./types";

export const FARMING_MARKET_ITEMS: MarketPriceItem[] = [
  {
    key: "lettuce",
    name: "상추",
    iconPath: "/icons/farming/lettuce.png",
    category: "farming",
    order: 1,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
  },
  {
    key: "corn",
    name: "옥수수",
    iconPath: "/icons/farming/corn.png",
    category: "farming",
    order: 2,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
  },
  {
    key: "cabbage",
    name: "양배추",
    iconPath: "/icons/farming/cabbage.png",
    category: "farming",
    order: 3,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "raddish",
    name: "무",
    iconPath: "/icons/farming/radish.png",
    category: "farming",
    order: 4,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "tomato",
    name: "토마토",
    iconPath: "/icons/farming/tomato.png",
    category: "farming",
    order: 5,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "strawberry",
    name: "딸기",
    iconPath: "/icons/farming/strawberry.png",
    category: "farming",
    order: 6,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "grape",
    name: "포도",
    iconPath: "/icons/farming/grape.png",
    category: "farming",
    order: 7,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "lemon",
    name: "레몬",
    iconPath: "/icons/farming/lemon.png",
    category: "farming",
    order: 8,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "orange",
    name: "오렌지",
    iconPath: "/icons/farming/orange.png",
    category: "farming",
    order: 9,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "pineapple",
    name: "파인애플",
    iconPath: "/icons/farming/pineapple.png",
    category: "farming",
    order: 10,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "banana",
    name: "바나나",
    iconPath: "/icons/farming/banana.png",
    category: "farming",
    order: 11,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
  {
    key: "pomegranate",
    name: "석류",
    iconPath: "/icons/farming/pomegranate.png",
    category: "farming",
    order: 12,
    gradeType: "triple",
    prices: { normal: 4, advanced: 8, rare: 12 },
    
  },
];

/**
 * =========================
 * 낚시 시세 기본값
 * =========================
 *
 * 현재는 시세 탭 UI와 저장/불러오기 구조를 먼저 완성하는 단계라서
 * 품목은 대표 예시 위주로 넣어 둔다.
 *
 * 나중에 실제 낚시 계산 로직에 들어가는 품목 기준으로
 * 순서/이름/아이콘/기본 시세를 정교하게 맞추면 된다.
 */
export const FISHING_MARKET_ITEMS: MarketPriceItem[] = [
  {
    key: "commonFish",
    name: "일반 물고기",
    iconPath: "/icons/fishing/commonFish.png",
    category: "fishing",
    order: 1,
    gradeType: "triple",
    prices: { normal: 6, advanced: 12, rare: 20 },
  },
  {
    key: "carp",
    name: "잉어",
    iconPath: "/icons/fishing/carp.png",
    category: "fishing",
    order: 2,
    gradeType: "triple",
    prices: { normal: 7, advanced: 14, rare: 24 },
  },
  {
    key: "salmon",
    name: "연어",
    iconPath: "/icons/fishing/salmon.png",
    category: "fishing",
    order: 3,
    gradeType: "triple",
    prices: { normal: 8, advanced: 16, rare: 27 },
  },
  {
    key: "pufferfish",
    name: "복어",
    iconPath: "/icons/fishing/pufferfish.png",
    category: "fishing",
    order: 4,
    gradeType: "triple",
    prices: { normal: 9, advanced: 18, rare: 30 },
  },
  {
    key: "tuna",
    name: "참치",
    iconPath: "/icons/fishing/tuna.png",
    category: "fishing",
    order: 5,
    gradeType: "triple",
    prices: { normal: 10, advanced: 20, rare: 34 },
  },
];

/**
 * =========================
 * 채광 시세 기본값
 * =========================
 *
 * 현재 채광 계산기 상세 구현은 보류 상태이므로
 * 대표 광물 위주로 먼저 탭/DB 구조만 준비한다.
 *
 * 나중에 실제 채광 계산 로직에 맞춰
 * 품목을 더 늘리면 된다.
 */
export const MINING_MARKET_ITEMS: MarketPriceItem[] = [
  {
    key: "coal",
    name: "석탄",
    iconPath: "/icons/mining/coal.png",
    category: "mining",
    order: 1,
    gradeType: "triple",
    prices: { normal: 3, advanced: 6, rare: 10 },
  },
  {
    key: "iron",
    name: "철",
    iconPath: "/icons/mining/iron.png",
    category: "mining",
    order: 2,
    gradeType: "triple",
    prices: { normal: 5, advanced: 10, rare: 16 },
  },
  {
    key: "gold",
    name: "금",
    iconPath: "/icons/mining/gold.png",
    category: "mining",
    order: 3,
    gradeType: "triple",
    prices: { normal: 7, advanced: 14, rare: 22 },
  },
  {
    key: "redstone",
    name: "레드스톤",
    iconPath: "/icons/mining/redstone.png",
    category: "mining",
    order: 4,
    gradeType: "triple",
    prices: { normal: 6, advanced: 12, rare: 18 },
  },
  {
    key: "diamond",
    name: "다이아몬드",
    iconPath: "/icons/mining/diamond.png",
    category: "mining",
    order: 5,
    gradeType: "triple",
    prices: { normal: 12, advanced: 24, rare: 40 },
  },
  {
    key: "netherite",
    name: "네더라이트",
    iconPath: "/icons/mining/netherite.png",
    category: "mining",
    order: 6,
    gradeType: "triple",
    prices: { normal: 20, advanced: 40, rare: 70 },
  },
];

/**
 * =========================
 * 요리 결과물 시세 기본값
 * =========================
 *
 * 요리는 3열 구조가 아니라
 * "일반 결과물 / 일품 결과물" 2종 가격 구조로 관리한다.
 *
 * gradeType:
 * - "cooking-result"
 *
 * prices:
 * - normal_result: 일반 결과물 시세
 * - special_result: 일품 결과물 시세
 */
export const COOKING_MARKET_ITEMS: MarketPriceItem[] = [
  {
    key: "ssambap",
    name: "쌈밥",
    iconPath: "/icons/cooking/ssambap.png",
    category: "cooking",
    order: 1,
    gradeType: "cooking-result",
    prices: { normal_result: 28, special_result: 62 },
  },
  {
    key: "cornJeon",
    name: "옥수수 전",
    iconPath: "/icons/cooking/cornJeon.png",
    category: "cooking",
    order: 2,
    gradeType: "cooking-result",
    prices: { normal_result: 30, special_result: 66 },
  },
  {
    key: "jeongol",
    name: "전골",
    iconPath: "/icons/cooking/jeongol.png",
    category: "cooking",
    order: 3,
    gradeType: "cooking-result",
    prices: { normal_result: 34, special_result: 72 },
  },
  {
    key: "radishJorim",
    name: "무조림",
    iconPath: "/icons/cooking/radishJorim.png",
    category: "cooking",
    order: 4,
    gradeType: "cooking-result",
    prices: { normal_result: 32, special_result: 70 },
  },
  {
    key: "gazpacho",
    name: "가스파초",
    iconPath: "/icons/cooking/gazpacho.png",
    category: "cooking",
    order: 5,
    gradeType: "cooking-result",
    prices: { normal_result: 31, special_result: 68 },
  },
  {
    key: "cornJuice",
    name: "옥수수 착즙 주스",
    iconPath: "/icons/cooking/cornJuice.png",
    category: "cooking",
    order: 6,
    gradeType: "cooking-result",
    prices: { normal_result: 16, special_result: 0 },
  },
  {
    key: "radishJuice",
    name: "무 착즙 주스",
    iconPath: "/icons/cooking/radishJuice.png",
    category: "cooking",
    order: 7,
    gradeType: "cooking-result",
    prices: { normal_result: 18, special_result: 0 },
  },
  {
    key: "bouillabaisse",
    name: "부야베스",
    iconPath: "/icons/cooking/bouillabaisse.png",
    category: "cooking",
    order: 8,
    gradeType: "cooking-result",
    prices: { normal_result: 54, special_result: 108 },
  },
  {
    key: "cioppino",
    name: "치오피노",
    iconPath: "/icons/cooking/cioppino.png",
    category: "cooking",
    order: 9,
    gradeType: "cooking-result",
    prices: { normal_result: 56, special_result: 112 },
  },
  {
    key: "paella",
    name: "파에야",
    iconPath: "/icons/cooking/paella.png",
    category: "cooking",
    order: 10,
    gradeType: "cooking-result",
    prices: { normal_result: 58, special_result: 116 },
  },
  {
    key: "ceviche",
    name: "세비체",
    iconPath: "/icons/cooking/ceviche.png",
    category: "cooking",
    order: 11,
    gradeType: "cooking-result",
    prices: { normal_result: 57, special_result: 114 },
  },
  {
    key: "pepes",
    name: "페페스",
    iconPath: "/icons/cooking/pepes.png",
    category: "cooking",
    order: 12,
    gradeType: "cooking-result",
    prices: { normal_result: 55, special_result: 110 },
  },
  {
    key: "seafoodGrillPlatter",
    name: "해산물 그릴 플래터",
    iconPath: "/icons/cooking/seafoodGrillPlatter.png",
    category: "cooking",
    order: 13,
    gradeType: "cooking-result",
    prices: { normal_result: 60, special_result: 122 },
  },
  {
    key: "teriyaki",
    name: "데리야키",
    iconPath: "/icons/cooking/teriyaki.png",
    category: "cooking",
    order: 14,
    gradeType: "cooking-result",
    prices: { normal_result: 59, special_result: 118 },
  },
  {
    key: "escabeche",
    name: "에스카베체",
    iconPath: "/icons/cooking/escabeche.png",
    category: "cooking",
    order: 15,
    gradeType: "cooking-result",
    prices: { normal_result: 61, special_result: 124 },
  },
  {
    key: "yangjangpi",
    name: "양장피",
    iconPath: "/icons/cooking/yangjangpi.png",
    category: "cooking",
    order: 16,
    gradeType: "cooking-result",
    prices: { normal_result: 63, special_result: 128 },
  },
];

/**
 * =========================
 * 강화 시세 기본값
 * =========================
 *
 * 강화는 일반/고급/희귀 같은 3등급 품목이 아니라
 * "개별 재료 하나당 단일 가격" 구조가 자연스럽다.
 *
 * gradeType:
 * - "single"
 *
 * prices:
 * - single: 해당 아이템 1개의 가격
 */
export const ENHANCEMENT_MARKET_ITEMS: MarketPriceItem[] = [
  {
    key: "normalScroll",
    name: "일반 주문서",
    iconPath: "/icons/enhancement/normalScroll.png",
    category: "enhancement",
    order: 1,
    gradeType: "single",
    prices: { single: 8000 },
  },
  {
    key: "advancedScroll",
    name: "고급 주문서",
    iconPath: "/icons/enhancement/advancedScroll.png",
    category: "enhancement",
    order: 2,
    gradeType: "single",
    prices: { single: 18000 },
  },
  {
    key: "rareScroll",
    name: "희귀 주문서",
    iconPath: "/icons/enhancement/rareScroll.png",
    category: "enhancement",
    order: 3,
    gradeType: "single",
    prices: { single: 48000 },
  },
  {
    key: "moonCharm",
    name: "달빛 부적",
    iconPath: "/icons/enhancement/moonCharm.png",
    category: "enhancement",
    order: 4,
    gradeType: "single",
    prices: { single: 20000 },
  },
  {
    key: "moonConcentrate",
    name: "달빛 기운 농축액",
    iconPath: "/icons/enhancement/moonConcentrate.png",
    category: "enhancement",
    order: 5,
    gradeType: "single",
    prices: { single: 12000 },
  },
];
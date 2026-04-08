import { FISHING_MARKET_ITEMS } from "@/src/lib/market/defaultPrices";

export type FishingBiomeKey =
  | "ocean"
  | "shore"
  | "river"
  | "swamp"
  | "mushroom"
  | "lake_temperate"
  | "lake_cold"
  | "lake_warm"
  | "lake_jungle"
  | "cave_lake";

export const FISHING_BIOME_OPTIONS: { value: FishingBiomeKey; label: string }[] = [
  { value: "ocean", label: "대양" },
  { value: "shore", label: "해안" },
  { value: "river", label: "강" },
  { value: "swamp", label: "늪" },
  { value: "mushroom", label: "버섯섬" },
  { value: "lake_temperate", label: "온대 호수" },
  { value: "lake_cold", label: "한랭 호수" },
  { value: "lake_warm", label: "건조 호수" },
  { value: "lake_jungle", label: "정글 호수" },
  { value: "cave_lake", label: "동굴 호수" },
];

/**
 * 위키 원본은 "최소 3마리 ON"이지만,
 * 현재 웹앱 요구사항은 "최소 5마리 이상 선택"이므로
 * 앱 정책으로 5를 사용한다.
 */
export const APP_MIN_FISH_SELECTION = 5;

/**
 * 기본 4종은 모든 바이옴에 공통으로 등장
 */
export const BASE_FISH_KEYS = ["miscFish", "carp", "catfish", "sardine"] as const;

export const BIOME_FISH_KEY_MAP: Record<FishingBiomeKey, string[]> = {
  ocean: [
    ...BASE_FISH_KEYS,
    "tuna",
    "seaBass",
    "mullet",
    "octopus",
    "sunfish",
    "sturgeon",
    "anglerfish",
    "stripedSeabream",
    "blueTang",
    "clownfish",
    "eel",
    "lobster",
    "mantaRay",
    "blueJellyfish",
    "redSnapper",
  ],
  shore: [...BASE_FISH_KEYS, "blueJellyfish", "eel", "swampFrog"],
  river: [...BASE_FISH_KEYS, "pike", "goldfish"],
  swamp: [...BASE_FISH_KEYS, "eel", "swampFrog"],
  mushroom: [...BASE_FISH_KEYS],
  lake_temperate: [...BASE_FISH_KEYS, "seaBass", "goldfish"],
  lake_cold: [...BASE_FISH_KEYS, "salmon", "sturgeon"],
  lake_warm: [...BASE_FISH_KEYS, "mullet", "sunfish"],
  lake_jungle: [...BASE_FISH_KEYS, "eel"],
  cave_lake: [...BASE_FISH_KEYS],
};

export const FISH_NAME_MAP = Object.fromEntries(
  FISHING_MARKET_ITEMS.map((item) => [item.key, item.name]),
) as Record<string, string>;

export const FISH_ICON_MAP = Object.fromEntries(
  FISHING_MARKET_ITEMS.map((item) => [item.key, item.iconPath ?? ""]),
) as Record<string, string>;

export function getDefaultFishKeysForBiome(biome: FishingBiomeKey): string[] {
  return [...(BIOME_FISH_KEY_MAP[biome] ?? [])];
}

export function createInitialFishSelectionByBiome(): Record<FishingBiomeKey, string[]> {
  return {
    ocean: getDefaultFishKeysForBiome("ocean"),
    shore: getDefaultFishKeysForBiome("shore"),
    river: getDefaultFishKeysForBiome("river"),
    swamp: getDefaultFishKeysForBiome("swamp"),
    mushroom: getDefaultFishKeysForBiome("mushroom"),
    lake_temperate: getDefaultFishKeysForBiome("lake_temperate"),
    lake_cold: getDefaultFishKeysForBiome("lake_cold"),
    lake_warm: getDefaultFishKeysForBiome("lake_warm"),
    lake_jungle: getDefaultFishKeysForBiome("lake_jungle"),
    cave_lake: getDefaultFishKeysForBiome("cave_lake"),
  };
}

export function canUseFishSelectionForBiome(biome: FishingBiomeKey): boolean {
  return (BIOME_FISH_KEY_MAP[biome]?.length ?? 0) >= APP_MIN_FISH_SELECTION;
}
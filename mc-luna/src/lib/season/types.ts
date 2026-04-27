/**
 * =========================
 * 계절/마을 공통 타입 & 상수
 * =========================
 *
 * 이번 구조의 핵심:
 * - world는 고정 enum 성격의 상수로 관리
 * - village는 DB(public.villages)에서 관리
 * - profile / season page 모두 이 파일의 타입과 옵션을 재사용
 */

export type WorldKey =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

export type WorldOption = {
  value: WorldKey;
  label: string;
};

/**
 * 월드 드롭다운은 DB와 무관하게 항상 전체 월드를 보여주기 위해
 * 프론트 상수로 유지한다.
 */
export const WORLD_OPTIONS: WorldOption[] = [
  { value: 'aries', label: '양자리' },
  { value: 'taurus', label: '황소자리' },
  { value: 'gemini', label: '쌍둥이자리' },
  { value: 'cancer', label: '게자리' },
  { value: 'leo', label: '사자자리' },
  { value: 'virgo', label: '처녀자리' },
  { value: 'libra', label: '천칭자리' },
  { value: 'scorpio', label: '전갈자리' },
  { value: 'sagittarius', label: '사수자리' },
  { value: 'capricorn', label: '염소자리' },
  { value: 'aquarius', label: '물병자리' },
  { value: 'pisces', label: '물고기자리' },
];

export type VillageRow = {
  id: string;
  world_key: WorldKey;
  village_name: string;
  is_active: boolean;
  display_order: number | null;
  created_at?: string;
  updated_at?: string;
};

export type VillageTimeReferenceRow = {
  id: string;
  village_id: string;
  real_observed_at: string;
  ingame_month: number;
  ingame_day: number;
  ingame_hour: number;
  ingame_minute: number;
  offset_from_base_minutes: number | null;
  memo: string | null;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * 기준 마을은 계산 로직의 절대 기준이므로
 * 상수로 명확하게 분리해 둔다.
 */
export const BASE_VILLAGE_WORLD_KEY: WorldKey = 'aries';
export const BASE_VILLAGE_NAME = '노동의숲';

export function isWorldKey(value: string): value is WorldKey {
  return WORLD_OPTIONS.some((option) => option.value === value);
}

export function getWorldLabel(worldKey: WorldKey): string {
  return WORLD_OPTIONS.find((option) => option.value === worldKey)?.label ?? worldKey;
}

export function getVillageFullLabel(village: Pick<VillageRow, 'world_key' | 'village_name'>): string {
  return `${getWorldLabel(village.world_key)} - ${village.village_name}`;
}

/**
 * 월드 변경 시 해당 월드의 마을 목록만 보여주기 위한 공통 헬퍼
 */
export function filterVillagesByWorld(
  villages: VillageRow[],
  worldKey: WorldKey,
): VillageRow[] {
  return villages.filter((village) => village.world_key === worldKey);
}

/**
 * 기준 마을 row를 찾는 공통 헬퍼
 */
export function findBaseVillage(villages: VillageRow[]): VillageRow | null {
  return (
    villages.find(
      (village) =>
        village.world_key === BASE_VILLAGE_WORLD_KEY &&
        village.village_name === BASE_VILLAGE_NAME,
    ) ?? null
  );
}

export type VillageKey =
  | "aries"
  | "taurus"
  | "gemini"
  | "leo"
  | "scorpio"
  | "aquarius";

export type SeasonName = "봄" | "여름" | "가을" | "겨울";

export interface VillageOption {
  value: VillageKey;
  label: string;
}

export interface SeasonCountdownItem {
  season: SeasonName;
  isCurrent: boolean;
  remainingMinutes: number;
}

export interface SeasonState {
  village: VillageKey;
  villageLabel: string;
  ingameMonth: number;
  ingameDay: number;
  ingameHour: number;
  ingameMinute: number;
  currentSeason: SeasonName;
  items: SeasonCountdownItem[];
}

/**
 * =========================
 * 서버 시간 규칙
 * =========================
 * - 현실 50초 = 인게임 1시간
 * - 계절 순서: 봄 -> 여름 -> 가을 -> 겨울
 * - 계절 1개 = 인게임 30일
 * - 표시 월은 3 -> 6 -> 9 -> 12 순환
 */

const REAL_SECONDS_PER_INGAME_HOUR = 50;
const INGAME_MINUTES_PER_HOUR = 60;
const REAL_REFERENCE = new Date("2026-04-13T14:59:49+09:00");

const DAYS_PER_SEASON = 30;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SEASONS_PER_YEAR = 4;

const INGAME_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR; // 1440
const INGAME_MINUTES_PER_SEASON = DAYS_PER_SEASON * INGAME_MINUTES_PER_DAY; // 43200
const INGAME_MINUTES_PER_YEAR = SEASONS_PER_YEAR * INGAME_MINUTES_PER_SEASON; // 172800

const SEASONS: SeasonName[] = ["봄", "여름", "가을", "겨울"];
const SEASON_MONTHS = [3, 6, 9, 12] as const;

/**
 * 기준 인게임 시각: 6월 27일 07:00
 * 6월 = 여름 = season index 1
 */
const REFERENCE_INGAME_TOTAL_MINUTES =
  (1 * DAYS_PER_SEASON + (27 - 1)) * INGAME_MINUTES_PER_DAY +
  7 * MINUTES_PER_HOUR;

/**
 * 마을별 양자리 대비 인게임 분 오프셋
 */
const VILLAGE_OFFSETS: Record<VillageKey, number> = {
  aries: 0,
  taurus: 0,
  gemini: 0,
  leo: 0,
  scorpio: 0,
  aquarius: 0,
};

export const VILLAGE_OPTIONS: VillageOption[] = [
  { value: "aries", label: "양자리" },
  { value: "taurus", label: "황소자리" },
  { value: "gemini", label: "쌍둥이자리" },
  { value: "leo", label: "사자자리" },
  { value: "scorpio", label: "전갈자리" },
  { value: "aquarius", label: "물병자리" },
];

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function getVillageLabel(village: VillageKey): string {
  return VILLAGE_OPTIONS.find((item) => item.value === village)?.label ?? village;
}

function getCurrentIngameTotalMinutes(village: VillageKey, now = new Date()): number {
  const elapsedRealSeconds = Math.floor(
    (now.getTime() - REAL_REFERENCE.getTime()) / 1000,
  );

  /**
   * 현실 50초 = 인게임 1시간
   * -> 현실 elapsedRealSeconds 동안 흐른 인게임 분
   */
  const elapsedIngameMinutes = Math.floor(
    (elapsedRealSeconds * INGAME_MINUTES_PER_HOUR) / REAL_SECONDS_PER_INGAME_HOUR,
  );

  return (
    REFERENCE_INGAME_TOTAL_MINUTES +
    elapsedIngameMinutes +
    VILLAGE_OFFSETS[village]
  );
}

function toCalendar(totalIngameMinutes: number) {
  const normalized = mod(totalIngameMinutes, INGAME_MINUTES_PER_YEAR);

  const totalDays = Math.floor(normalized / INGAME_MINUTES_PER_DAY);
  const minuteOfDay = mod(normalized, INGAME_MINUTES_PER_DAY);

  const seasonIndex = Math.floor(totalDays / DAYS_PER_SEASON); // 0~3
  const day = (totalDays % DAYS_PER_SEASON) + 1;
  const month = SEASON_MONTHS[seasonIndex];

  const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minute = minuteOfDay % MINUTES_PER_HOUR;

  return {
    seasonIndex,
    month,
    day,
    hour,
    minute,
    totalDays,
    minuteOfDay,
  };
}

function getSeasonIndex(totalIngameMinutes: number): number {
  return toCalendar(totalIngameMinutes).seasonIndex;
}

function getRemainingRealMinutesToSeason(
  totalIngameMinutes: number,
  targetSeasonIndex: number,
): number {
  const { totalDays, minuteOfDay } = toCalendar(totalIngameMinutes);
  const currentSeasonIndex = Math.floor(totalDays / DAYS_PER_SEASON);

  if (currentSeasonIndex === targetSeasonIndex) {
    return 0;
  }

  const nextTargetStartDay =
    targetSeasonIndex * DAYS_PER_SEASON > totalDays
      ? targetSeasonIndex * DAYS_PER_SEASON
      : targetSeasonIndex * DAYS_PER_SEASON + DAYS_PER_SEASON * SEASONS_PER_YEAR;

  const remainingIngameDays = nextTargetStartDay - totalDays;
  const remainingIngameHours =
    remainingIngameDays * HOURS_PER_DAY - minuteOfDay / MINUTES_PER_HOUR;

  /**
   * 현실 50초 = 인게임 1시간
   * -> 인게임 시간(시간 단위)을 현실 분으로 변환
   */
  return Math.max(0, Math.floor((remainingIngameHours * 50) / 60));
}

export function formatIngameDate(
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const mm = String(minute).padStart(2, "0");
  return `${month}월 ${day}일 ${hour}:${mm}`;
}

export function formatRemainingTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분`;
}

export function getSeasonState(village: VillageKey, now = new Date()): SeasonState {
  const currentTotal = getCurrentIngameTotalMinutes(village, now);
  const calendar = toCalendar(currentTotal);
  const currentSeasonIndex = getSeasonIndex(currentTotal);
  const currentSeason = SEASONS[currentSeasonIndex];

  const items: SeasonCountdownItem[] = SEASONS.map((season, index) => ({
    season,
    isCurrent: index === currentSeasonIndex,
    remainingMinutes: getRemainingRealMinutesToSeason(currentTotal, index),
  }));

  return {
    village,
    villageLabel: getVillageLabel(village),
    ingameMonth: calendar.month,
    ingameDay: calendar.day,
    ingameHour: calendar.hour,
    ingameMinute: calendar.minute,
    currentSeason,
    items,
  };
}
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
 * - 계절 순서: 봄 -> 여름 -> 가을 -> 겨울
 * - 표시 월: 3 -> 6 -> 9 -> 12
 * - 한 계절 = 28일
 * - 현실 20분 = 인게임 24시간
 *
 * 기준 시각
 * - 현실: 2026-04-16 16:39:00 (KST)
 * - 인게임: 봄 3월 2일 12:00
 */

const DAYS_PER_SEASON = 28;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SEASONS_PER_YEAR = 4;

const INGAME_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR; // 1440
const INGAME_MINUTES_PER_SEASON = DAYS_PER_SEASON * INGAME_MINUTES_PER_DAY; // 40320
const INGAME_MINUTES_PER_YEAR = SEASONS_PER_YEAR * INGAME_MINUTES_PER_SEASON; // 161280

const SEASONS: SeasonName[] = ["봄", "여름", "가을", "겨울"];
const SEASON_MONTHS = [3, 6, 9, 12] as const;

/**
 * 현실 20분 = 인게임 24시간
 * -> 현실 1200초 = 인게임 1440분
 * -> 현실 1초 = 인게임 1.2분
 */
const REAL_SECONDS_PER_INGAME_MINUTE = 1200 / 1440; // 0.833333...
const INGAME_MINUTES_PER_REAL_SECOND = 1440 / 1200; // 1.2

/**
 * 기준 현실 시각: 2026-04-16 16:39:00 +09:00
 */
const REAL_REFERENCE = new Date("2026-04-16T16:39:00+09:00");

/**
 * 기준 인게임 시각: 봄 3월 2일 12:00
 * - 봄 = season index 0
 * - day는 1일부터 시작하므로 내부 계산에서는 (2 - 1)
 */
const REFERENCE_INGAME_TOTAL_MINUTES =
  ((0 * DAYS_PER_SEASON) + (2 - 1)) * INGAME_MINUTES_PER_DAY +
  12 * MINUTES_PER_HOUR;

/**
 * 마을별 양자리 대비 인게임 분 오프셋
 *
 * 예:
 * - 양자리보다 인게임 3시간 빠르면 180
 * - 양자리보다 인게임 2시간 느리면 -120
 *
 * 현재는 기준값이 없으므로 모두 0
 */
const VILLAGE_OFFSETS: Record<VillageKey, number> = {
  aries: 0,

  /**
   * 사진 기준 양자리와 비교한 인게임 분 오프셋
   * 음수 = 양자리보다 느림(더 이전 시간대)
   */
  taurus: -18813,   // 황소자리: 13일 1시간 33분 느림
  gemini: -37047,   // 쌍둥이자리: 25일 17시간 27분 느림
  leo: -23185,      // 사자자리: 16일 2시간 25분 느림
  scorpio: -35962,  // 전갈자리: 24일 23시간 22분 느림
  aquarius: -33904, // 물병자리: 23일 13시간 4분 느림
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
  const elapsedRealSeconds = (now.getTime() - REAL_REFERENCE.getTime()) / 1000;

  const elapsedIngameMinutes = Math.floor(
    elapsedRealSeconds * INGAME_MINUTES_PER_REAL_SECOND,
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
  const remainingIngameMinutes =
    remainingIngameDays * INGAME_MINUTES_PER_DAY - minuteOfDay;

  const remainingRealSeconds =
    remainingIngameMinutes * REAL_SECONDS_PER_INGAME_MINUTE;

  return Math.max(0, Math.floor(remainingRealSeconds / 60));
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
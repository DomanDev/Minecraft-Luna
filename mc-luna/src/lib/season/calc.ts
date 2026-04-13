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
 * - 현실 1분 = 인게임 1시간
 * - 현실 1초 = 인게임 1분
 * - 한 계절 = 인게임 30일
 * - 계절 순서: 봄 -> 여름 -> 가을 -> 겨울
 *
 * 현재 확정 기준:
 * - 양자리 기준
 * - 현실 03:55:19 시점에 인게임 6월 27일 07:00
 *
 * 주의:
 * - 기준 "날짜"까지 확정되어야 완전 정확해진다.
 * - 우선은 기준 시각을 코드 상수로 두고 사용한다.
 * - 나머지 마을은 양자리 대비 오프셋을 나중에 실측해서 넣으면 된다.
 */

const REAL_REFERENCE = new Date("2026-04-13T03:55:19+09:00");

/**
 * 6월 27일 07:00
 * 내부 계산은 30일 * 12개월 가정
 */
const DAYS_PER_MONTH = 30;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MONTHS_PER_YEAR = 12;

const INGAME_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR; // 1440
const INGAME_MINUTES_PER_MONTH = DAYS_PER_MONTH * INGAME_MINUTES_PER_DAY; // 43200
const INGAME_MINUTES_PER_YEAR =
  MONTHS_PER_YEAR * INGAME_MINUTES_PER_MONTH; // 518400

const REFERENCE_INGAME_TOTAL_MINUTES =
  ((6 - 1) * DAYS_PER_MONTH + (27 - 1)) * INGAME_MINUTES_PER_DAY +
  7 * MINUTES_PER_HOUR;

const SEASONS: SeasonName[] = ["봄", "여름", "가을", "겨울"];
const DAYS_PER_SEASON = 30;
const SEASON_CYCLE_DAYS = DAYS_PER_SEASON * 4; // 120일

/**
 * 양자리 기준 오프셋(인게임 분)
 *
 * 현재는 양자리 기준값만 확정되어 있으므로
 * 나머지는 0으로 두고 나중에 실제 측정값으로 교체한다.
 *
 * 예:
 * 양자리보다 인게임 3시간 빠르면 180
 * 양자리보다 인게임 2시간 느리면 -120
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
  /**
   * 현실 경과 ms -> 현실 경과 초 -> 인게임 경과 분
   * 현실 1초 = 인게임 1분
   */
  const elapsedRealSeconds = Math.floor((now.getTime() - REAL_REFERENCE.getTime()) / 1000);
  const elapsedIngameMinutes = elapsedRealSeconds;

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

  const month = Math.floor(totalDays / DAYS_PER_MONTH) + 1;
  const day = (totalDays % DAYS_PER_MONTH) + 1;
  const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minute = minuteOfDay % MINUTES_PER_HOUR;

  return {
    month,
    day,
    hour,
    minute,
    totalDays,
    minuteOfDay,
  };
}

function getSeasonIndex(totalIngameMinutes: number): number {
  const { totalDays } = toCalendar(totalIngameMinutes);
  const cycleDay = mod(totalDays, SEASON_CYCLE_DAYS);
  return Math.floor(cycleDay / DAYS_PER_SEASON);
}

function getRemainingRealMinutesToSeason(
  totalIngameMinutes: number,
  targetSeasonIndex: number,
): number {
  const { totalDays, minuteOfDay } = toCalendar(totalIngameMinutes);
  const currentCycleDay = mod(totalDays, SEASON_CYCLE_DAYS);
  const currentSeasonIndex = Math.floor(currentCycleDay / DAYS_PER_SEASON);

  if (currentSeasonIndex === targetSeasonIndex) {
    return 0;
  }

  const nextTargetStartDay =
    targetSeasonIndex * DAYS_PER_SEASON > currentCycleDay
      ? targetSeasonIndex * DAYS_PER_SEASON
      : targetSeasonIndex * DAYS_PER_SEASON + SEASON_CYCLE_DAYS;

  const remainingIngameDays = nextTargetStartDay - currentCycleDay;
  const remainingIngameHours =
    remainingIngameDays * HOURS_PER_DAY - minuteOfDay / MINUTES_PER_HOUR;

  /**
   * 현실 1분 = 인게임 1시간
   */
  return Math.max(0, Math.floor(remainingIngameHours));
}

export function formatIngameDate(month: number, day: number, hour: number, minute: number) {
  const mm = String(minute).padStart(2, "0");
  return `${month}월 ${day}일 ${hour}:${mm}`;
}

export function formatRemainingTime(totalMinutes: number) {
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
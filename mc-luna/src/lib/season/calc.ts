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
 * - 계절 1개 = 인게임 30일
 * - 표시 월은 3 -> 6 -> 9 -> 12 순환
 *
 * 기준점 3개를 사용해
 * "현실 몇 초 = 인게임 몇 분" 비율을 평균으로 계산한다.
 *
 * 입력 팁:
 * - 인게임 시각은 가능하면 XX:00 기준으로 측정
 * - 현실 시각은 초 단위까지 기록
 * - 기준점은 최소 3개 이상 권장
 */

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
 * 마을별 양자리 대비 인게임 분 오프셋
 *
 * 예:
 * - 양자리보다 인게임 3시간 빠르면 180
 * - 양자리보다 인게임 2시간 느리면 -120
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

/**
 * =========================
 * 기준점 3개 설정
 * =========================
 *
 * month는 실제 표시 월(3, 6, 9, 12)만 사용
 * day는 1~30
 * hour는 0~23
 * minute는 보통 0으로 측정 권장
 *
 * 아래 값들은 예시다.
 * 반드시 네가 실제로 측정한 값으로 교체해야 한다.
 */
interface TimeReferencePoint {
  real: string; // ISO 문자열, 예: "2026-04-13T14:59:49+09:00"
  month: 3 | 6 | 9 | 12;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 예시 기준값
 *
 * 사용 방법:
 * 1) 인게임에서 정각(예: 07:00, 12:00, 18:00)일 때 캡처
 * 2) 그 순간의 현실 시각을 초 단위까지 적기
 * 3) 아래 3개를 실제 측정값으로 바꾸기
 */
const TIME_REFERENCES: [TimeReferencePoint, TimeReferencePoint, TimeReferencePoint] = [
  {
    real: "2026-04-13T17:31:39+09:00",
    month: 6,
    day: 6,
    hour: 6,
    minute: 0,
  },
  {
    real: "2026-04-13T17:48:19+09:00",
    month: 6,
    day: 7,
    hour: 2,
    minute: 0,
  },
  {
    real: "2026-04-13T17:40:59+09:00",
    month: 6,
    day: 6,
    hour: 16,
    minute: 0,
  },
];

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function getVillageLabel(village: VillageKey): string {
  return VILLAGE_OPTIONS.find((item) => item.value === village)?.label ?? village;
}

function monthToSeasonIndex(month: 3 | 6 | 9 | 12): number {
  switch (month) {
    case 3:
      return 0;
    case 6:
      return 1;
    case 9:
      return 2;
    case 12:
      return 3;
  }
}

function referenceToIngameTotalMinutes(point: TimeReferencePoint): number {
  const seasonIndex = monthToSeasonIndex(point.month);

  return (
    (seasonIndex * DAYS_PER_SEASON + (point.day - 1)) * INGAME_MINUTES_PER_DAY +
    point.hour * MINUTES_PER_HOUR +
    point.minute
  );
}

function getSortedReferences() {
  return TIME_REFERENCES
    .map((point) => ({
      realDate: new Date(point.real),
      ingameTotalMinutes: referenceToIngameTotalMinutes(point),
    }))
    .sort((a, b) => a.realDate.getTime() - b.realDate.getTime());
}

/**
 * 현실 몇 초가 인게임 1분인지 평균 계산
 *
 * 기준점 3개 설정
 * 각 구간의 "현실 초 / 인게임 분"을 구해서 평균 계산
 */
function getAverageRealSecondsPerIngameMinute(): number {
  const refs = getSortedReferences();

  let total = 0;
  let count = 0;

  for (let i = 0; i < refs.length - 1; i += 1) {
    const current = refs[i];
    const next = refs[i + 1];

    const realSeconds =
      (next.realDate.getTime() - current.realDate.getTime()) / 1000;
    const ingameMinutes = next.ingameTotalMinutes - current.ingameTotalMinutes;

    if (realSeconds > 0 && ingameMinutes > 0) {
      total += realSeconds / ingameMinutes;
      count += 1;
    }
  }

  /**
   * 혹시 기준값이 이상하면 안전하게 기본값 사용
   * 50초 = 1시간 -> 1분당 50/60초
   */
  if (count === 0) {
    return 50 / 60;
  }

  return total / count;
}

function getBaseReference() {
  const refs = getSortedReferences();
  return refs[0];
}

function getCurrentIngameTotalMinutes(village: VillageKey, now = new Date()): number {
  const baseReference = getBaseReference();
  const realSecondsPerIngameMinute = getAverageRealSecondsPerIngameMinute();

  const elapsedRealSeconds =
    (now.getTime() - baseReference.realDate.getTime()) / 1000;

  const elapsedIngameMinutes = Math.floor(
    elapsedRealSeconds / realSecondsPerIngameMinute,
  );

  return (
    baseReference.ingameTotalMinutes +
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

/**
 * 남은 현실 시간 계산도
 * 측정한 평균 속도를 그대로 사용한다.
 */
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

  const remainingIngameMinutes = remainingIngameHours * MINUTES_PER_HOUR;
  const realSecondsPerIngameMinute = getAverageRealSecondsPerIngameMinute();
  const remainingRealSeconds = remainingIngameMinutes * realSecondsPerIngameMinute;

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
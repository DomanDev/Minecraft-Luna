import {
  getVillageFullLabel,
  getWorldLabel,
  getWorldOnlyLabel,
  type VillageRow,
  type VillageTimeReferenceRow,
  type WorldKey,
  type WorldTimeReferenceRow,
} from '@/src/lib/season/types';

export type SeasonName = '봄' | '여름' | '가을' | '겨울';

export type SeasonOffsetSource =
  | 'base'
  | 'stored_offset'
  | 'observed_reference';

export interface SeasonCountdownItem {
  season: SeasonName;
  isCurrent: boolean;
  remainingMinutes: number;
}

export interface ResolvedSeasonOffset {
  offsetMinutes: number;
  source: SeasonOffsetSource;
  storedOffsetMinutes: number | null;
  observedOffsetMinutes: number | null;
}

export interface SeasonState {
  worldKey: WorldKey;
  worldLabel: string;
  villageId: string | null;
  villageName: string;
  villageLabel: string;
  selectionMode: 'world' | 'village';
  ingameMonth: number;
  ingameDay: number;
  ingameHour: number;
  ingameMinute: number;
  currentSeason: SeasonName;
  items: SeasonCountdownItem[];
  offsetSource: SeasonOffsetSource;
  effectiveOffsetMinutes: number;
  observedAt: string | null;
  referenceMemo: string | null;
}

type SeasonReferenceLike = Pick<
  VillageTimeReferenceRow,
  | 'real_observed_at'
  | 'ingame_month'
  | 'ingame_day'
  | 'ingame_hour'
  | 'ingame_minute'
  | 'offset_from_base_minutes'
  | 'memo'
> | null;

/**
 * =========================
 * 서버 시간 규칙
 * =========================
 * - 계절 순서: 봄 -> 여름 -> 가을 -> 겨울
 * - 표시 월: 3 -> 6 -> 9 -> 12
 * - 한 계절 = 28일
 * - 현실 20분 = 인게임 24시간
 *
 * 기준 시각(기준 마을: 양자리 - 노동의숲)
 * - 현실: 2026-04-16 16:39:00 +09:00
 * - 인게임: 봄 3월 2일 12:00
 */
const DAYS_PER_SEASON = 28;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SEASONS_PER_YEAR = 4;

const INGAME_MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR; // 1440
const INGAME_MINUTES_PER_SEASON = DAYS_PER_SEASON * INGAME_MINUTES_PER_DAY; // 40320
const INGAME_MINUTES_PER_YEAR = SEASONS_PER_YEAR * INGAME_MINUTES_PER_SEASON; // 161280

const SEASONS: SeasonName[] = ['봄', '여름', '가을', '겨울'];
const SEASON_MONTHS = [3, 6, 9, 12] as const;

/**
 * 현실 20분 = 인게임 24시간
 * -> 현실 1200초 = 인게임 1440분
 * -> 현실 1초 = 인게임 1.2분
 */
const REAL_SECONDS_PER_INGAME_MINUTE = 1200 / 1440;
const INGAME_MINUTES_PER_REAL_SECOND = 1440 / 1200;

const BASE_REAL_REFERENCE = new Date('2026-04-16T16:39:00+09:00');

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

function normalizeCycleMinutes(totalMinutes: number): number {
  return mod(totalMinutes, INGAME_MINUTES_PER_YEAR);
}

/**
 * 두 시점 차이를 1년 주기 안에서 "가장 짧은 signed offset" 으로 정규화한다.
 */
function normalizeSignedCycleDifference(value: number): number {
  const normalized = normalizeCycleMinutes(value);

  if (normalized > INGAME_MINUTES_PER_YEAR / 2) {
    return normalized - INGAME_MINUTES_PER_YEAR;
  }

  return normalized;
}

/**
 * 3/6/9/12월 체계를 "1년 주기 누적 분" 으로 변환한다.
 */
export function toCycleMinutesFromCalendar(
  month: number,
  day: number,
  hour: number,
  minute: number,
): number | null {
  const seasonIndex = SEASON_MONTHS.indexOf(month as (typeof SEASON_MONTHS)[number]);

  if (seasonIndex === -1) {
    return null;
  }

  if (day < 1 || day > DAYS_PER_SEASON) {
    return null;
  }

  if (hour < 0 || hour >= HOURS_PER_DAY) {
    return null;
  }

  if (minute < 0 || minute >= MINUTES_PER_HOUR) {
    return null;
  }

  return (
    ((seasonIndex * DAYS_PER_SEASON) + (day - 1)) * INGAME_MINUTES_PER_DAY +
    hour * MINUTES_PER_HOUR +
    minute
  );
}

/**
 * 기준 마을의 기준 인게임 시각: 봄 3월 2일 12:00
 */
const BASE_REFERENCE_INGAME_TOTAL_MINUTES =
  toCycleMinutesFromCalendar(3, 2, 12, 0) ?? 0;

export function getBaseIngameTotalMinutesAt(now = new Date()): number {
  const elapsedRealSeconds = (now.getTime() - BASE_REAL_REFERENCE.getTime()) / 1000;
  const elapsedIngameMinutes = Math.floor(
    elapsedRealSeconds * INGAME_MINUTES_PER_REAL_SECOND,
  );

  return BASE_REFERENCE_INGAME_TOTAL_MINUTES + elapsedIngameMinutes;
}

function toCalendar(totalIngameMinutes: number) {
  const normalized = normalizeCycleMinutes(totalIngameMinutes);
  const totalDays = Math.floor(normalized / INGAME_MINUTES_PER_DAY);
  const minuteOfDay = mod(normalized, INGAME_MINUTES_PER_DAY);
  const seasonIndex = Math.floor(totalDays / DAYS_PER_SEASON);

  return {
    seasonIndex,
    month: SEASON_MONTHS[seasonIndex],
    day: (totalDays % DAYS_PER_SEASON) + 1,
    hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
    minute: minuteOfDay % MINUTES_PER_HOUR,
    totalDays,
    minuteOfDay,
  };
}

function getRemainingRealMinutesToSeasonStart(
  totalIngameMinutes: number,
  targetSeasonIndex: number,
): number {
  const { totalDays, minuteOfDay } = toCalendar(totalIngameMinutes);
  const currentSeasonIndex = Math.floor(totalDays / DAYS_PER_SEASON);

  if (currentSeasonIndex === targetSeasonIndex) {
    return 0;
  }

  const targetStartDay =
    targetSeasonIndex * DAYS_PER_SEASON > totalDays
      ? targetSeasonIndex * DAYS_PER_SEASON
      : targetSeasonIndex * DAYS_PER_SEASON + DAYS_PER_SEASON * SEASONS_PER_YEAR;

  const remainingIngameDays = targetStartDay - totalDays;
  const remainingIngameMinutes =
    remainingIngameDays * INGAME_MINUTES_PER_DAY - minuteOfDay;
  const remainingRealSeconds =
    remainingIngameMinutes * REAL_SECONDS_PER_INGAME_MINUTE;

  return Math.max(0, Math.floor(remainingRealSeconds / 60));
}

/**
 * 관측값(real_observed_at + ingame_*)이 있으면
 * 기준 마을과의 offset을 관측값으로부터 역산한다.
 */
export function deriveObservedOffsetFromBase(
  reference: SeasonReferenceLike,
): number | null {
  if (!reference) {
    return null;
  }

  const observedAt = new Date(reference.real_observed_at);

  if (Number.isNaN(observedAt.getTime())) {
    return null;
  }

  const observedCycleMinutes = toCycleMinutesFromCalendar(
    reference.ingame_month,
    reference.ingame_day,
    reference.ingame_hour,
    reference.ingame_minute,
  );

  if (observedCycleMinutes == null) {
    return null;
  }

  const baseCycleMinutesAtObserved = normalizeCycleMinutes(
    getBaseIngameTotalMinutesAt(observedAt),
  );

  return normalizeSignedCycleDifference(
    observedCycleMinutes - baseCycleMinutesAtObserved,
  );
}

/**
 * offset 적용 우선순위
 * 1) 최신 관측값으로 역산한 offset
 * 2) DB에 직접 저장한 offset_from_base_minutes
 * 3) 아무 값도 없으면 0(=기준 마을과 동일)
 */
export function resolveSeasonOffset(
  reference: SeasonReferenceLike,
): ResolvedSeasonOffset {
  const observedOffsetMinutes = deriveObservedOffsetFromBase(reference);

  if (observedOffsetMinutes != null) {
    return {
      offsetMinutes: observedOffsetMinutes,
      source: 'observed_reference',
      storedOffsetMinutes: reference?.offset_from_base_minutes ?? null,
      observedOffsetMinutes,
    };
  }

  if (typeof reference?.offset_from_base_minutes === 'number') {
    const normalizedStoredOffset = normalizeSignedCycleDifference(
      reference.offset_from_base_minutes,
    );

    return {
      offsetMinutes: normalizedStoredOffset,
      source: 'stored_offset',
      storedOffsetMinutes: normalizedStoredOffset,
      observedOffsetMinutes: null,
    };
  }

  return {
    offsetMinutes: 0,
    source: 'base',
    storedOffsetMinutes: null,
    observedOffsetMinutes: null,
  };
}

export function formatIngameDate(
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  const paddedMinute = String(minute).padStart(2, '0');
  return `${month}월 ${day}일 ${hour}:${paddedMinute}`;
}

export function formatRemainingTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}시간 ${minutes}분`;
}

export function formatOffsetMinutes(offsetMinutes: number): string {
  const absMinutes = Math.abs(offsetMinutes);
  const days = Math.floor(absMinutes / INGAME_MINUTES_PER_DAY);
  const hours = Math.floor((absMinutes % INGAME_MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const minutes = absMinutes % MINUTES_PER_HOUR;
  const sign = offsetMinutes >= 0 ? '+' : '-';

  return `${sign}${days}일 ${hours}시간 ${minutes}분`;
}

export function getOffsetSourceLabel(source: SeasonOffsetSource): string {
  switch (source) {
    case 'observed_reference':
      return '최신 관측값 기반 보정';
    case 'stored_offset':
      return '저장된 offset 기반';
    case 'base':
    default:
      return '기준 마을과 동일';
  }
}

export function getSeasonState(params: {
  worldKey: WorldKey;
  village?: VillageRow | null;
  reference?: SeasonReferenceLike;
  now?: Date;
}): SeasonState {
  const { worldKey, village = null, reference = null, now = new Date() } = params;
  const resolvedOffset = resolveSeasonOffset(reference);
  const currentTotal = getBaseIngameTotalMinutesAt(now) + resolvedOffset.offsetMinutes;
  const calendar = toCalendar(currentTotal);
  const currentSeasonIndex = calendar.seasonIndex;
  const currentSeason = SEASONS[currentSeasonIndex];

  const items: SeasonCountdownItem[] = SEASONS.map((season, index) => ({
    season,
    isCurrent: index === currentSeasonIndex,
    remainingMinutes: getRemainingRealMinutesToSeasonStart(currentTotal, index),
  }));

  return {
    worldKey,
    worldLabel: getWorldLabel(worldKey),
    villageId: village?.id ?? null,
    villageName: village?.village_name ?? '없음',
    villageLabel: village ? getVillageFullLabel(village) : getWorldOnlyLabel(worldKey),
    selectionMode: village ? 'village' : 'world',
    ingameMonth: calendar.month,
    ingameDay: calendar.day,
    ingameHour: calendar.hour,
    ingameMinute: calendar.minute,
    currentSeason,
    items,
    offsetSource: resolvedOffset.source,
    effectiveOffsetMinutes: resolvedOffset.offsetMinutes,
    observedAt: reference?.real_observed_at ?? null,
    referenceMemo: reference?.memo ?? null,
  };
}

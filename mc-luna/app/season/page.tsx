"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import CalculatorLayout from '@/src/components/calculator/CalculatorLayout';
import CalculatorPanel from '@/src/components/calculator/CalculatorPanel';
import Field from '@/src/components/calculator/Field';
import SelectInput from '@/src/components/calculator/SelectInput';
import ResultCard from '@/src/components/calculator/ResultCard';
import { useAuth } from '@/src/hooks/useAuth';
import {
  fetchActiveVillages,
  fetchLatestVillageTimeReferences,
  fetchLatestWorldTimeReferences,
  fetchMyProfileSeasonLocation,
} from '@/src/lib/season/repository';
import {
  BASE_VILLAGE_NAME,
  BASE_VILLAGE_WORLD_KEY,
  WORLD_OPTIONS,
  filterVillagesByWorld,
  getWorldLabel,
  type ProfileSeasonLocation,
  type VillageRow,
  type VillageTimeReferenceRow,
  type WorldKey,
  type WorldTimeReferenceRow,
} from '@/src/lib/season/types';
import {
  formatIngameDate,
  formatOffsetMinutes,
  formatRemainingTime,
  getOffsetSourceLabel,
  getSeasonState,
} from '@/src/lib/season/calc';

function getSeasonVisual(season: string, isCurrent: boolean) {
  switch (season) {
    case '봄':
      return {
        icon: '🌸',
        cardClass: isCurrent
          ? 'border-pink-300 bg-pink-50 shadow-sm'
          : 'border-pink-200 bg-pink-50/60',
        titleClass: isCurrent ? 'text-pink-700' : 'text-pink-600',
        valueClass: isCurrent ? 'text-pink-900' : 'text-zinc-900',
      };
    case '여름':
      return {
        icon: '☀️',
        cardClass: isCurrent
          ? 'border-amber-300 bg-amber-50 shadow-sm'
          : 'border-amber-200 bg-amber-50/60',
        titleClass: isCurrent ? 'text-amber-700' : 'text-amber-600',
        valueClass: isCurrent ? 'text-amber-900' : 'text-zinc-900',
      };
    case '가을':
      return {
        icon: '🍂',
        cardClass: isCurrent
          ? 'border-orange-300 bg-orange-50 shadow-sm'
          : 'border-orange-200 bg-orange-50/60',
        titleClass: isCurrent ? 'text-orange-700' : 'text-orange-600',
        valueClass: isCurrent ? 'text-orange-900' : 'text-zinc-900',
      };
    case '겨울':
      return {
        icon: '❄️',
        cardClass: isCurrent
          ? 'border-sky-300 bg-sky-50 shadow-sm'
          : 'border-sky-200 bg-sky-50/60',
        titleClass: isCurrent ? 'text-sky-700' : 'text-sky-600',
        valueClass: isCurrent ? 'text-sky-900' : 'text-zinc-900',
      };
    default:
      return {
        icon: '🕒',
        cardClass: isCurrent
          ? 'border-emerald-300 bg-emerald-50 shadow-sm'
          : 'border-zinc-200 bg-white',
        titleClass: 'text-zinc-600',
        valueClass: 'text-zinc-900',
      };
  }
}

function SeasonStatusCard({
  season,
  isCurrent,
  remainingMinutes,
}: {
  season: string;
  isCurrent: boolean;
  remainingMinutes: number;
}) {
  const visual = getSeasonVisual(season, isCurrent);

  return (
    <div
      className={`min-h-[92px] rounded-2xl border p-4 transition-all ${visual.cardClass} ${
        isCurrent ? 'ring-2 ring-white/70 ring-offset-1' : ''
      }`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${visual.titleClass}`}>
        <span className="text-base leading-none">{visual.icon}</span>
        <span>{season}</span>
      </div>

      <div
        className={`mt-3 whitespace-nowrap text-sm font-bold leading-snug sm:text-base ${visual.valueClass}`}
      >
        {isCurrent ? '현재 계절' : `${formatRemainingTime(remainingMinutes)} 후`}
      </div>
    </div>
  );
}

function formatObservedAt(value: string | null): string {
  if (!value) {
    return '없음';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function formatProfileLocationLabel(
  profileLocation: ProfileSeasonLocation | null,
  villages: VillageRow[],
): string {
  if (!profileLocation) {
    return '없음';
  }

  const village =
    villages.find((item) => item.id === profileLocation.current_village_id) ?? null;

  if (village) {
    return `${getWorldLabel(village.world_key)} - ${village.village_name}`;
  }

  if (profileLocation.current_world_key) {
    return `${getWorldLabel(profileLocation.current_world_key)} - 없음`;
  }

  return '없음';
}

export default function SeasonPage() {
  const { user, loading: authLoading } = useAuth();

  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [referencesByVillageId, setReferencesByVillageId] = useState<
    Record<string, VillageTimeReferenceRow>
  >({});
  const [referencesByWorldKey, setReferencesByWorldKey] = useState<
    Record<string, WorldTimeReferenceRow>
  >({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [profileLocation, setProfileLocation] =
    useState<ProfileSeasonLocation | null>(null);
  const [selectedWorldKey, setSelectedWorldKey] =
    useState<WorldKey>(BASE_VILLAGE_WORLD_KEY);
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const initializedSelectionRef = useRef(false);

  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  /**
   * 마을 목록 / 최신 관측값 로드
   */
  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError('');

        const [nextVillages, nextVillageReferences, nextWorldReferences] = await Promise.all([
          fetchActiveVillages(),
          fetchLatestVillageTimeReferences(),
          fetchLatestWorldTimeReferences(),
        ]);

        if (!mounted) {
          return;
        }

        setVillages(nextVillages);
        setReferencesByVillageId(nextVillageReferences);
        setReferencesByWorldKey(nextWorldReferences);
      } catch (error) {
        console.error('계절용 마을 데이터 로드 실패:', error);

        if (!mounted) {
          return;
        }

        setCatalogError(
          error instanceof Error
            ? error.message
            : '계절 데이터를 불러오는 중 오류가 발생했습니다.',
        );
        setVillages([]);
        setReferencesByVillageId({});
        setReferencesByWorldKey({});
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * 로그인 사용자라면 profiles.current_world_key / current_village_id 를 읽어와
   * season page 기본 선택값으로 사용한다.
   */
  useEffect(() => {
    let mounted = true;

    const loadProfileLocation = async () => {
      if (authLoading) {
        return;
      }

      if (!user) {
        setProfileLocation(null);
        return;
      }

      try {
        const nextLocation = await fetchMyProfileSeasonLocation(user.id);

        if (!mounted) {
          return;
        }

        setProfileLocation(nextLocation);
      } catch (error) {
        console.error('프로필 저장 위치 조회 실패:', error);

        if (!mounted) {
          return;
        }

        setProfileLocation(null);
      }
    };

    void loadProfileLocation();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  /**
   * 최초 기본 선택값 결정
   *
   * 우선순위:
   * 1) profiles.current_village_id
   * 2) profiles.current_world_key + 마을 없음
   * 3) 기준 월드(양자리) + 마을 없음
   */
  useEffect(() => {
    if (catalogLoading || authLoading || initializedSelectionRef.current) {
      return;
    }

    const profileVillage =
      villages.find((item) => item.id === profileLocation?.current_village_id) ?? null;

    initializedSelectionRef.current = true;

    if (profileVillage) {
      setSelectedWorldKey(profileVillage.world_key);
      setSelectedVillageId(profileVillage.id);
      return;
    }

    setSelectedWorldKey(profileLocation?.current_world_key ?? BASE_VILLAGE_WORLD_KEY);
    setSelectedVillageId('');
  }, [authLoading, catalogLoading, profileLocation, villages]);

  const filteredVillages = useMemo(() => {
    return filterVillagesByWorld(villages, selectedWorldKey);
  }, [villages, selectedWorldKey]);

  const selectedVillage = useMemo(() => {
    return villages.find((item) => item.id === selectedVillageId) ?? null;
  }, [villages, selectedVillageId]);

  const selectedReference = useMemo(() => {
    if (selectedVillage) {
      return referencesByVillageId[selectedVillage.id] ?? null;
    }

    return referencesByWorldKey[selectedWorldKey] ?? null;
  }, [referencesByVillageId, referencesByWorldKey, selectedVillage, selectedWorldKey]);

  const seasonState = useMemo(() => {
    return getSeasonState({
      worldKey: selectedWorldKey,
      village: selectedVillage,
      reference: selectedReference,
      now: new Date(tick),
    });
  }, [selectedReference, selectedVillage, selectedWorldKey, tick]);

  const currentTimeText = useMemo(() => {
    return formatIngameDate(
      seasonState.ingameMonth,
      seasonState.ingameDay,
      seasonState.ingameHour,
      seasonState.ingameMinute,
    );
  }, [seasonState]);

  const currentSeasonVisual = useMemo(() => {
    return getSeasonVisual(seasonState.currentSeason, true);
  }, [seasonState.currentSeason]);

  const summaryRows = useMemo(() => {
    return [
      ['선택한 월드', seasonState.worldLabel],
      ['선택한 마을', seasonState.villageName],
      ['현재 계절', seasonState.currentSeason],
      ['현재 인게임 시각', currentTimeText],
      ['보정 기준', getOffsetSourceLabel(seasonState.offsetSource)],
      ['기준 마을 대비 오프셋', formatOffsetMinutes(seasonState.effectiveOffsetMinutes)],
      ['최근 관측 시각', formatObservedAt(seasonState.observedAt)],
    ] as [string, string][];
  }, [currentTimeText, seasonState]);

  const handleWorldChange = (value: WorldKey) => {
    setSelectedWorldKey(value);

    /**
     * 변경 요청 반영:
     * - 월드를 바꿔도 마을은 자동으로 첫 번째를 고르지 않는다.
     * - 기본값은 항상 '없음' 상태를 유지한다.
     * - 이렇게 해야 월드별 기준 시각을 따로 지정해 둔 값을 바로 사용할 수 있다.
     */
    setSelectedVillageId('');
  };

  const profileLocationLabel = useMemo(() => {
    return formatProfileLocationLabel(profileLocation, villages);
  }, [profileLocation, villages]);

  if (catalogLoading) {
    return <div className="p-6">계절 데이터를 불러오는 중...</div>;
  }

  if (catalogError) {
    return <div className="p-6 text-rose-600">{catalogError}</div>;
  }

  return (
    <CalculatorLayout
      title="계절 계산기"
      left={
        <CalculatorPanel title="설정">
          <div className="space-y-4">
            <Field
              label="현재 위치한 월드"
              hint="프로필에 저장된 월드가 있으면 그 월드를 기본값으로 불러옵니다."
            >
              <SelectInput
                value={selectedWorldKey}
                onChange={(value) => handleWorldChange(value as WorldKey)}
                options={WORLD_OPTIONS}
              />
            </Field>

            <Field
              label="현재 위치한 마을"
              hint="프로필에 저장된 마을이 없으면 기본값은 '없음'이며, 이 경우 월드 기준 시각을 사용합니다."
            >
              <SelectInput
                value={selectedVillageId}
                onChange={(value) => setSelectedVillageId(value as string)}
                options={[
                  { value: '', label: '없음' },
                  ...filteredVillages.map((village) => ({
                    value: village.id,
                    label: village.village_name,
                  })),
                ]}
              />
            </Field>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <div className="font-semibold text-zinc-900">프로필 기본 위치</div>
              <div className="mt-1">{profileLocationLabel}</div>
            </div>

            <div
              className={`rounded-2xl border p-4 transition-all ${currentSeasonVisual.cardClass}`}
            >
              <div className="text-sm text-zinc-600">현재 위치</div>
              <div className={`mt-1 text-lg font-bold ${currentSeasonVisual.titleClass}`}>
                {seasonState.villageLabel}
              </div>

              <div className="mt-4 text-sm text-zinc-600">현재 계절</div>
              <div
                className={`mt-1 flex items-center gap-2 text-2xl font-bold ${currentSeasonVisual.valueClass}`}
              >
                <span className="text-2xl leading-none">{currentSeasonVisual.icon}</span>
                <span>{seasonState.currentSeason}</span>
              </div>

              <div className="mt-4 text-sm text-zinc-600">현재 인게임 시각</div>
              <div className={`mt-1 text-base font-semibold ${currentSeasonVisual.valueClass}`}>
                {currentTimeText}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <div className="font-semibold">현재 계산 기준</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>기준 마을: {getWorldLabel(BASE_VILLAGE_WORLD_KEY)} / {BASE_VILLAGE_NAME}</li>
                <li>기준 시각: 현실 2026-04-16 16:39:00 = 인게임 봄 3월 2일 12:00</li>
                <li>시간 규칙: 현실 20분 = 인게임 24시간</li>
                <li>마을을 선택하면 마을 기준 관측값을 우선 사용합니다.</li>
                <li>마을이 '없음'이면 선택한 월드의 기준 관측값을 사용합니다.</li>
                <li>보정 방식: 최신 관측값 우선, 없으면 저장된 offset_from_base_minutes 사용</li>
              </ul>
            </div>
          </div>
        </CalculatorPanel>
      }
      right={
        <div className="space-y-6">
          <ResultCard title="계절 남은 시간">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {seasonState.items.map((item) => (
                <SeasonStatusCard
                  key={item.season}
                  season={item.season}
                  isCurrent={item.isCurrent}
                  remainingMinutes={item.remainingMinutes}
                />
              ))}
            </div>
          </ResultCard>

          <ResultCard title="요약">
            <div className="space-y-2 text-sm text-zinc-700">
              {summaryRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                >
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-right font-medium text-zinc-900">{value}</span>
                </div>
              ))}
            </div>
          </ResultCard>

          <ResultCard title="관측 메모">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              {seasonState.referenceMemo?.trim()
                ? seasonState.referenceMemo
                : '최신 관측 메모가 없습니다.'}
            </div>
          </ResultCard>
        </div>
      }
    />
  );
}

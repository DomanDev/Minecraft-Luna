'use client';

/**
 * [계절 계산기 페이지]
 *
 * UI 목표
 * - 예전 계절 계산기 스타일처럼 단순한 구성으로 복구
 * - 왼쪽: 월드 / 마을 선택 + 현재 상태 카드
 * - 오른쪽: 계절 남은 시간 카드 4개
 *
 * 기능 목표
 * - 새로고침 시 프로필 저장 위치를 자동으로 반영
 *   1) current_village_id 있으면 해당 마을 선택
 *   2) 없고 current_world_key만 있으면 해당 월드 + 없음
 *   3) 둘 다 없으면 양자리 + 없음
 *
 * 주의
 * - 월드를 바꾸면 마을은 자동으로 첫 번째를 고르지 않고 항상 '없음'으로 초기화
 * - season 계산 로직(getSeasonState)은 기존 공통 유틸을 그대로 사용
 */

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
  formatRemainingTime,
  getSeasonState,
} from '@/src/lib/season/calc';

/**
 * 계절별 카드 스타일
 */
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
        icon: '🍁',
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

/**
 * 왼쪽 큰 현재 상태 카드
 * - 예전 UI처럼 한 장에 현재 위치 / 계절 / 인게임 시각을 모아 보여준다.
 */
function CurrentStatusCard({
  currentLocationLabel,
  currentSeason,
  currentTimeText,
}: {
  currentLocationLabel: string;
  currentSeason: string;
  currentTimeText: string;
}) {
  const visual = getSeasonVisual(currentSeason, true);

  return (
    <div className={`rounded-3xl border p-6 ${visual.cardClass}`}>
      <div className="space-y-6">
        <div>
          <div className="text-sm font-medium text-zinc-500">현재 위치</div>
          <div className={`mt-2 text-3xl font-extrabold ${visual.titleClass}`}>
            {currentLocationLabel}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-zinc-500">현재 계절</div>
          <div className={`mt-2 text-5xl font-extrabold ${visual.valueClass}`}>
            {visual.icon} {currentSeason}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-zinc-500">
            현재 인게임 시각
          </div>
          <div className={`mt-2 text-3xl font-bold ${visual.titleClass}`}>
            {currentTimeText}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 오른쪽 계절 남은 시간 카드
 */
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
    <div className={`rounded-3xl border p-6 transition ${visual.cardClass}`}>
      <div className={`text-2xl font-extrabold ${visual.titleClass}`}>
        {visual.icon} {season}
      </div>

      <div className={`mt-4 text-4xl font-extrabold ${visual.valueClass}`}>
        {isCurrent ? '현재 계절' : formatRemainingTime(remainingMinutes)}
      </div>

      {!isCurrent ? (
        <div className="mt-2 text-sm font-medium text-zinc-500">후</div>
      ) : null}
    </div>
  );
}

/**
 * 현재 위치 표시 문자열
 * - 마을 있으면 "양자리 - 노동의숲"
 * - 없으면 "양자리 - 없음"
 */
function formatCurrentLocationLabel(
  selectedWorldKey: WorldKey,
  selectedVillage: VillageRow | null,
): string {
  if (selectedVillage) {
    return `${getWorldLabel(selectedVillage.world_key)} - ${selectedVillage.village_name}`;
  }

  return `${getWorldLabel(selectedWorldKey)} - 없음`;
}

export default function SeasonPage() {
  const { user, loading: authLoading } = useAuth();

  /**
   * 공통 카탈로그 데이터
   */
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [referencesByVillageId, setReferencesByVillageId] = useState<
    Record<string, VillageTimeReferenceRow>
  >({});
  const [referencesByWorldKey, setReferencesByWorldKey] = useState<
    Record<string, WorldTimeReferenceRow>
  >({});

  /**
   * 로딩 / 에러 상태
   */
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  /**
   * 프로필 저장 위치
   */
  const [profileLocation, setProfileLocation] =
    useState<ProfileSeasonLocation | null>(null);

  /**
   * 중요:
   * - profileLocation이 null이라는 사실과
   * - 아직 조회 전이라 null인 상태를 구분하기 위해 별도 loading 사용
   * - 이 값이 없으면 새로고침 시 기본값이 먼저 박혀버릴 수 있음
   */
  const [profileLocationLoading, setProfileLocationLoading] = useState(true);

  /**
   * 현재 화면 선택값
   * - selectedVillageId === '' 이면 마을 없음
   */
  const [selectedWorldKey, setSelectedWorldKey] =
    useState<WorldKey>(BASE_VILLAGE_WORLD_KEY);
  const [selectedVillageId, setSelectedVillageId] = useState('');

  /**
   * 프로필 자동 선택은 최초 1회만 수행
   */
  const initializedSelectionRef = useRef(false);

  /**
   * 실시간 시각 갱신용 tick
   */
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
   * 마을 / 기준값 데이터 로드
   */
  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError('');

        const [nextVillages, nextVillageReferences, nextWorldReferences] =
          await Promise.all([
            fetchActiveVillages(),
            fetchLatestVillageTimeReferences(),
            fetchLatestWorldTimeReferences(),
          ]);

        if (!mounted) return;

        setVillages(nextVillages);
        setReferencesByVillageId(nextVillageReferences);
        setReferencesByWorldKey(nextWorldReferences);
      } catch (error) {
        console.error('계절 데이터 로드 실패:', error);

        if (!mounted) return;

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
   * 프로필 저장 위치 조회
   */
  useEffect(() => {
    let mounted = true;

    const loadProfileLocation = async () => {
      if (authLoading) return;

      try {
        setProfileLocationLoading(true);

        if (!user) {
          if (!mounted) return;
          setProfileLocation(null);
          return;
        }

        const nextLocation = await fetchMyProfileSeasonLocation(user.id);

        if (!mounted) return;
        setProfileLocation(nextLocation);
      } catch (error) {
        console.error('프로필 저장 위치 조회 실패:', error);

        if (!mounted) return;
        setProfileLocation(null);
      } finally {
        if (mounted) {
          setProfileLocationLoading(false);
        }
      }
    };

    void loadProfileLocation();

    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  /**
   * 최초 기본 선택값 적용
   *
   * 우선순위:
   * 1) current_village_id 있으면 해당 마을 선택
   * 2) current_world_key만 있으면 해당 월드 + 없음
   * 3) 둘 다 없으면 양자리 + 없음
   */
  useEffect(() => {
    if (
      catalogLoading ||
      authLoading ||
      profileLocationLoading ||
      initializedSelectionRef.current
    ) {
      return;
    }

    const profileVillage =
      villages.find((item) => item.id === profileLocation?.current_village_id) ??
      null;

    initializedSelectionRef.current = true;

    if (profileVillage) {
      setSelectedWorldKey(profileVillage.world_key);
      setSelectedVillageId(profileVillage.id);
      return;
    }

    setSelectedWorldKey(
      profileLocation?.current_world_key ?? BASE_VILLAGE_WORLD_KEY,
    );
    setSelectedVillageId('');
  }, [
    authLoading,
    catalogLoading,
    profileLocation,
    profileLocationLoading,
    villages,
  ]);

  /**
   * 선택 월드에 속한 마을 목록만 드롭다운에 노출
   */
  const filteredVillages = useMemo(() => {
    return filterVillagesByWorld(villages, selectedWorldKey);
  }, [villages, selectedWorldKey]);

  /**
   * 현재 선택된 마을 row
   */
  const selectedVillage = useMemo(() => {
    return villages.find((item) => item.id === selectedVillageId) ?? null;
  }, [villages, selectedVillageId]);

  /**
   * 현재 선택 기준의 reference
   * - 마을 선택 시 village_time_references
   * - 마을 미선택 시 world_time_references
   */
  const selectedReference = useMemo(() => {
    if (selectedVillage) {
      return referencesByVillageId[selectedVillage.id] ?? null;
    }

    return referencesByWorldKey[selectedWorldKey] ?? null;
  }, [
    referencesByVillageId,
    referencesByWorldKey,
    selectedVillage,
    selectedWorldKey,
  ]);

  /**
   * 실제 계절 계산 결과
   */
  const seasonState = useMemo(() => {
    return getSeasonState({
      worldKey: selectedWorldKey,
      village: selectedVillage,
      reference: selectedReference,
      now: new Date(tick),
    });
  }, [selectedReference, selectedVillage, selectedWorldKey, tick]);

  /**
   * 현재 인게임 시각 문자열
   */
  const currentTimeText = useMemo(() => {
    return formatIngameDate(
      seasonState.ingameMonth,
      seasonState.ingameDay,
      seasonState.ingameHour,
      seasonState.ingameMinute,
    );
  }, [seasonState]);

  /**
   * 현재 위치 표시용 문자열
   */
  const currentLocationLabel = useMemo(() => {
    return formatCurrentLocationLabel(selectedWorldKey, selectedVillage);
  }, [selectedVillage, selectedWorldKey]);

  /**
   * 월드 변경 시
   * - 마을은 자동으로 선택하지 않고 '없음'으로 초기화
   */
  const handleWorldChange = (value: WorldKey) => {
    setSelectedWorldKey(value);
    setSelectedVillageId('');
  };

  /**
   * 최초 로딩 대기
   */
  if (catalogLoading || authLoading || profileLocationLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-zinc-500">
        계절 데이터를 불러오는 중...
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {catalogError}
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      title="계절 계산기"
      left={
        <CalculatorPanel title="설정">
          <div className="space-y-6">
            <Field label="현재 위치한 월드">
              <SelectInput
                value={selectedWorldKey}
                onChange={(value) => handleWorldChange(value as WorldKey)}
                options={WORLD_OPTIONS}
              />
            </Field>

            <Field label="현재 위치한 마을">
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

            <p className="text-sm leading-6 text-zinc-500">
              프로필에 저장된 월드-마을이 있으면 페이지 로드시 자동으로 적용됩니다.
            </p>

            <CurrentStatusCard
              currentLocationLabel={currentLocationLabel}
              currentSeason={seasonState.currentSeason}
              currentTimeText={currentTimeText}
            />
          </div>
        </CalculatorPanel>
      }
      right={
        <ResultCard title="계절 남은 시간">
          <div className="grid gap-4 md:grid-cols-2">
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
      }
    />
  );
}
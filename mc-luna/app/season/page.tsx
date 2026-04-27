'use client';

/**
 * [계절 계산기 페이지]
 *
 * 수정 목적
 * 1) CalculatorLayout의 실제 props 구조(title, left, right)에 맞게 수정
 * 2) 새로고침 시 프로필 저장 위치(current_world_key, current_village_id)를
 *    드롭다운 / 현재 위치 / 계절 카드 계산에 바로 반영
 * 3) 불필요한 UI 제거
 *    - 프로필 기본 위치
 *    - 현재 계산 기준
 *    - 요약
 *    - 관측 메모
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
 * 현재 위치 텍스트 생성
 * - 마을 선택 시: "양자리 - 노동의숲"
 * - 마을 미선택 시: "양자리 - 없음"
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
 * 계절 남은 시간 카드
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
    <div className={`rounded-2xl border p-4 transition ${visual.cardClass}`}>
      <div className={`text-base font-semibold ${visual.titleClass}`}>
        {visual.icon} {season}
      </div>

      <div className={`mt-2 text-sm font-medium ${visual.valueClass}`}>
        {isCurrent ? '현재 계절' : `${formatRemainingTime(remainingMinutes)} 후`}
      </div>
    </div>
  );
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
   * 로딩 / 에러
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
   * profileLocation 값이 null인 것과
   * "아직 조회 중이라 null인 것"은 구분해야 한다.
   * 이 상태를 따로 두지 않으면 새로고침 시 기본값이 먼저 고정될 수 있다.
   */
  const [profileLocationLoading, setProfileLocationLoading] = useState(true);

  /**
   * 화면 선택값
   * - selectedVillageId === '' 이면 마을 없음
   */
  const [selectedWorldKey, setSelectedWorldKey] =
    useState<WorldKey>(BASE_VILLAGE_WORLD_KEY);
  const [selectedVillageId, setSelectedVillageId] = useState('');

  /**
   * 프로필 기본값 자동 적용은 최초 1회만 수행
   */
  const initializedSelectionRef = useRef(false);

  /**
   * 1초마다 현재 시각 갱신
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
   * villages / reference 데이터 로드
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
   * 프로필 위치 로드
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
   * 우선순위
   * 1) current_village_id 가 있으면 해당 마을 자동 선택
   * 2) current_world_key 만 있으면 해당 월드 + 없음
   * 3) 둘 다 없으면 양자리 + 없음
   *
   * 핵심:
   * - profileLocationLoading 이 false 되기 전에는 실행하지 않는다.
   * - 그래야 새로고침 시 프로필 값이 오기 전에 기본값으로 고정되는 문제를 막을 수 있다.
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
   * 선택 월드 기준 마을 목록
   */
  const filteredVillages = useMemo(() => {
    return filterVillagesByWorld(villages, selectedWorldKey);
  }, [villages, selectedWorldKey]);

  /**
   * 선택된 마을 row
   */
  const selectedVillage = useMemo(() => {
    return villages.find((item) => item.id === selectedVillageId) ?? null;
  }, [villages, selectedVillageId]);

  /**
   * 선택 기준의 reference
   * - 마을 선택 시 village reference
   * - 마을 없음이면 world reference
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
   * 현재 계절 계산
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
   * 현재 인게임 시각 텍스트
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
   * 현재 위치 표시 문자열
   */
  const currentLocationLabel = useMemo(() => {
    return formatCurrentLocationLabel(selectedWorldKey, selectedVillage);
  }, [selectedVillage, selectedWorldKey]);

  /**
   * 현재 계절 카드 스타일
   */
  const currentSeasonVisual = useMemo(() => {
    return getSeasonVisual(seasonState.currentSeason, true);
  }, [seasonState.currentSeason]);

  /**
   * 월드 변경 시 마을은 항상 "없음"으로 초기화
   */
  const handleWorldChange = (value: WorldKey) => {
    setSelectedWorldKey(value);
    setSelectedVillageId('');
  };

  /**
   * 최초 로딩
   * - 카탈로그와 프로필 위치가 모두 준비될 때까지 대기
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
          </div>
        </CalculatorPanel>
      }
      right={
        <div className="space-y-4">
          <ResultCard title="현재 정보">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-medium text-zinc-500">현재 위치</div>
                <div className="mt-1 text-base font-semibold text-zinc-900">
                  {currentLocationLabel}
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 ${currentSeasonVisual.cardClass}`}
              >
                <div className="text-xs font-medium text-zinc-500">현재 계절</div>
                <div
                  className={`mt-1 text-base font-semibold ${currentSeasonVisual.valueClass}`}
                >
                  {currentSeasonVisual.icon} {seasonState.currentSeason}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-medium text-zinc-500">
                  현재 인게임 시각
                </div>
                <div className="mt-1 text-base font-semibold text-zinc-900">
                  {currentTimeText}
                </div>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="계절 남은 시간">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      }
    />
  );
}
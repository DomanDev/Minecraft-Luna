'use client';

/**
 * [계절 계산기 페이지]
 *
 * 이번 수정 목표
 * 1) 프로필에 저장된 월드-마을을 페이지 로드시 자동 선택
 * 2) 프로필 위치 조회가 끝나기 전에 기본값(양자리-없음)으로 고정되는 버그 수정
 * 3) UI를 단순화:
 *    - 제거: 프로필 기본 위치 / 현재 계산 기준 / 요약 / 관측 메모
 *    - 유지: 월드 선택 / 마을 선택 / 현재 위치 / 현재 계절 / 현재 인게임 시각 / 계절 남은 시간
 *
 * 핵심 버그 원인
 * - 기존 코드에서는 profileLocation 이 아직 null 인 상태에서도
 *   "초기 선택값 결정" effect 가 먼저 실행될 수 있었다.
 * - 그 순간 initializedSelectionRef.current 가 true 로 바뀌면
 *   나중에 profileLocation 이 실제로 로드되어도 다시 반영되지 않았다.
 *
 * 해결 방식
 * - profileLocationLoading state 를 추가
 * - 프로필 위치 조회가 끝난 뒤에만 초기 선택 effect 실행
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
 * 계절 카드 색상/아이콘
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

/**
 * 현재 위치 문자열
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
   * DB에서 읽는 공통 데이터
   */
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [referencesByVillageId, setReferencesByVillageId] = useState<
    Record<string, VillageTimeReferenceRow>
  >({});
  const [referencesByWorldKey, setReferencesByWorldKey] = useState<
    Record<WorldKey, WorldTimeReferenceRow>
  >({} as Record<WorldKey, WorldTimeReferenceRow>);

  /**
   * 카탈로그 로딩/에러
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
   * - profileLocation 자체가 null 일 수도 있음(정상)
   * - 그래서 "조회가 끝났는지" 여부를 별도 state 로 관리해야 함
   * - 이 값이 없으면 초기 선택 effect 가 너무 빨리 실행될 수 있다
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
   * 초기 자동 선택은 1회만 수행
   */
  const initializedSelectionRef = useRef(false);

  /**
   * 현재 시각 갱신용
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
   * 계절용 공통 카탈로그 로드
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
        setReferencesByWorldKey({} as Record<WorldKey, WorldTimeReferenceRow>);
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
   * 로그인 사용자의 프로필 위치 조회
   */
  useEffect(() => {
    let mounted = true;

    const loadProfileLocation = async () => {
      if (authLoading) {
        return;
      }

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
   * 2) current_world_key 만 있으면 해당 월드 + 마을 없음
   * 3) 둘 다 없으면 양자리 + 마을 없음
   *
   * 핵심:
   * - profileLocationLoading 이 false 가 되기 전에는 실행하지 않는다.
   * - 그래야 profileLocation 이 null 초기값일 때 잘못 고정되지 않는다.
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
   * 선택 월드에 해당하는 마을만 드롭다운에 표시
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
   * 선택 기준 reference
   * - 마을이 있으면 village reference
   * - 없으면 world reference
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
   * 현재 위치 문자열
   */
  const currentLocationLabel = useMemo(() => {
    return formatCurrentLocationLabel(selectedWorldKey, selectedVillage);
  }, [selectedVillage, selectedWorldKey]);

  /**
   * 현재 계절 강조 스타일
   */
  const currentSeasonVisual = useMemo(() => {
    return getSeasonVisual(seasonState.currentSeason, true);
  }, [seasonState.currentSeason]);

  /**
   * 월드 변경 시
   * - 마을은 항상 '없음'으로 초기화
   */
  const handleWorldChange = (value: WorldKey) => {
    setSelectedWorldKey(value);
    setSelectedVillageId('');
  };

  /**
   * 최초 로딩 화면
   * - 카탈로그 + 프로필 위치가 둘 다 준비될 때까지 대기
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
      description="월드와 마을을 선택해 현재 계절과 인게임 시간을 확인합니다."
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
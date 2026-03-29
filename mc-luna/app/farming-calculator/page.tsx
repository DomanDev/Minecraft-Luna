"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { calculateFarming } from "@/src/lib/farming/calc";
import { calculateFarmingExp } from "@/src/lib/farming/exp";
import { OATH_OF_CULTIVATION_MAX_POTS } from "@/src/lib/farming/skillTables";
import type {
  FarmingCalculationInput,
  FarmingCalculationResult,
  FarmingCropType,
} from "@/src/lib/farming/types";

/**
 * 작물 선택 드롭다운 옵션
 * - value: 내부 계산용 키
 * - label: 화면 표시용 텍스트
 */
const cropOptions: { value: FarmingCropType; label: string }[] = [
  { value: "cabbage", label: "양배추" },
  { value: "lettuce", label: "상추" },
  { value: "corn", label: "옥수수" },
  { value: "radish", label: "무" },
  { value: "tomato", label: "토마토" },
  { value: "strawberry", label: "딸기" },
  { value: "grape", label: "포도" },
  { value: "lemon", label: "레몬" },
  { value: "orange", label: "오렌지" },
  { value: "pineapple", label: "파인애플" },
  { value: "banana", label: "바나나" },
  { value: "pomegranate", label: "석류" },
];

/**
 * 페이지 초기 입력값
 * - 농사 1사이클 계산에 필요한 최소값만 우선 사용
 * - thirst(갈증)는 지금 단계에선 사용자가 수동 입력
 */
const INITIAL_FORM = {
  luck: 0,
  sense: 0,

  blessingOfHarvest: 0,
  fertileSoil: 0,
  oathOfCultivation: 0,

  potCount: 96,
  thirst: 0,
  cropType: "cabbage" as FarmingCropType,

  normalPrice: 10,
  advancedPrice: 20,
  rarePrice: 35,
};

/**
 * 초기 계산 입력 객체 생성
 */
function createInitialCalculationInput(): FarmingCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
    },
    skills: {
      blessingOfHarvest: INITIAL_FORM.blessingOfHarvest,
      fertileSoil: INITIAL_FORM.fertileSoil,
      oathOfCultivation: INITIAL_FORM.oathOfCultivation,
    },
    environment: {
      potCount: INITIAL_FORM.potCount,
      thirst: INITIAL_FORM.thirst,
      cropType: INITIAL_FORM.cropType,
    },
    prices: {
      normal: INITIAL_FORM.normalPrice,
      advanced: INITIAL_FORM.advancedPrice,
      rare: INITIAL_FORM.rarePrice,
    },
  };
}

/**
 * 숫자 입력 공통 변환 함수
 * - 빈 문자열은 0 처리
 * - NaN 방지
 */
function parseNumber(value: string): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

/**
 * 퍼센트 보기 좋게 표시
 */
function toPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/**
 * 숫자 보기 좋게 표시
 */
function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export default function FarmingCalculatorPage() {
  /**
   * =========================
   * 입력 폼 state
   * =========================
   */
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  // 스탯
  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  // 스킬
  const [blessingOfHarvest, setBlessingOfHarvest] = useState(
    INITIAL_FORM.blessingOfHarvest
  );
  const [fertileSoil, setFertileSoil] = useState(INITIAL_FORM.fertileSoil);
  const [oathOfCultivation, setOathOfCultivation] = useState(
    INITIAL_FORM.oathOfCultivation
  );

  // 환경/입력
  const [potCount, setPotCount] = useState(INITIAL_FORM.potCount);
  const [thirst, setThirst] = useState(INITIAL_FORM.thirst);
  const [cropType, setCropType] = useState<FarmingCropType>(
    INITIAL_FORM.cropType
  );

  // 시세
  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  /**
   * =========================
   * 결과 state
   * =========================
   * - 낚시 계산기와 같은 방식:
   *   버튼 클릭 시에만 결과 반영
   */
  const [result, setResult] = useState<FarmingCalculationResult>(() =>
    calculateFarming(createInitialCalculationInput())
  );
  const [isDirty, setIsDirty] = useState(false);

  /**
   * =========================
   * 경험치 계산 state
   * =========================
   * - "수확 1회당 경험치" 기준
   * - 2개 드롭은 경험치 추가 없음
   * - 비옥한 토양 추가 재배는 경험치 1회 추가
   */
  const [expPerHarvest, setExpPerHarvest] = useState(1);
  const [remainingExp, setRemainingExp] = useState(0);
  const [expResult, setExpResult] = useState<{
    expPerCycle: number;
    cyclesToGoal: number;
    totalMinutesToGoal: number;
    totalHoursToGoal: number;
  } | null>(null);
  const [isExpDirty, setIsExpDirty] = useState(false);

  /**
   * 개간의 서약 레벨 기준 최대 화분통 수
   * - 표시용
   * - 초기 자동 입력에도 사용
   */
  const maxPotCountBySkill = useMemo(() => {
    return OATH_OF_CULTIVATION_MAX_POTS[oathOfCultivation] ?? 96;
  }, [oathOfCultivation]);

  /**
   * Pro 여부
   * - 프로필에서 불러온 스탯/스킬은 Pro만 수정 가능
   */
  const isProUser = planType === "pro";
  const disableProfileFields = profileLoaded && !isProUser;

  /**
   * 계산기 입력 객체 생성
   */
  const buildCalculationInput = (): FarmingCalculationInput => {
    return {
      stats: {
        luck,
        sense,
      },
      skills: {
        blessingOfHarvest,
        fertileSoil,
        oathOfCultivation,
      },
      environment: {
        potCount,
        thirst,
        cropType,
      },
      prices: {
        normal: normalPrice,
        advanced: advancedPrice,
        rare: rarePrice,
      },
    };
  };

  /**
   * 프로필 자동 불러오기
   *
   * 기대 테이블:
   * - profiles(plan_type)
   * - farming_profiles(luck_total, sense_total)
   * - user_skill_levels(skill_id, skill_level)
   * - skill_definitions(id, skill_name_ko, job_code='farming')
   */
  useEffect(() => {
    let isMounted = true;

    const loadProfileToCalculator = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      // 1) 플랜 타입 조회
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("plan_type")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.warn("profiles 조회 실패:", profileError.message);
        return;
      }

      const nextPlanType = (profileRow?.plan_type ?? "free") as "free" | "pro";

      // 2) farming_profiles 조회
      const { data: farmingProfile, error: farmingProfileError } =
        await supabase
          .from("farming_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

      if (farmingProfileError || !farmingProfile) {
        console.warn("farming_profiles 조회 실패:", farmingProfileError?.message);
        setPlanType(nextPlanType);
        return;
      }

      // 3) 유저 스킬 레벨 조회
      const { data: skillLevels, error: skillLevelsError } = await supabase
        .from("user_skill_levels")
        .select("skill_id, skill_level")
        .eq("user_id", user.id);

      if (skillLevelsError) {
        console.warn("user_skill_levels 조회 실패:", skillLevelsError.message);
        return;
      }

      // 4) 농사 스킬 정의 조회
      const { data: skillDefinitions, error: skillDefinitionsError } =
        await supabase
          .from("skill_definitions")
          .select("id, skill_name_ko")
          .eq("job_code", "farming")
          .eq("is_enabled", true);

      if (skillDefinitionsError) {
        console.warn("skill_definitions 조회 실패:", skillDefinitionsError.message);
        return;
      }

      // skill_id -> 한글 스킬명 매핑
      const skillMap = Object.fromEntries(
        (skillLevels ?? []).map((row) => {
          const matched = (skillDefinitions ?? []).find(
            (def) => def.id === row.skill_id
          );
          return [matched?.skill_name_ko ?? "", row.skill_level];
        })
      );

      if (!isMounted) return;

      // 5) 스탯 / 스킬 상태 반영
      const nextLuck = Number(farmingProfile.luck_total ?? INITIAL_FORM.luck);
      const nextSense = Number(farmingProfile.sense_total ?? INITIAL_FORM.sense);
      const nextBlessing = Number(
        skillMap["풍년의 축복"] ?? INITIAL_FORM.blessingOfHarvest
      );
      const nextFertileSoil = Number(
        skillMap["비옥한 토양"] ?? INITIAL_FORM.fertileSoil
      );
      const nextOath = Number(
        skillMap["개간의 서약"] ?? INITIAL_FORM.oathOfCultivation
      );

      const nextMaxPots = OATH_OF_CULTIVATION_MAX_POTS[nextOath] ?? 96;

      setLuck(nextLuck);
      setSense(nextSense);
      setBlessingOfHarvest(nextBlessing);
      setFertileSoil(nextFertileSoil);
      setOathOfCultivation(nextOath);

      // 최대 화분통 수를 기본값으로 자동 입력
      setPotCount(nextMaxPots);

      setPlanType(nextPlanType);
      setProfileLoaded(true);
      setIsDirty(true);
    };

    loadProfileToCalculator();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * 개간의 서약 레벨이 바뀌면,
   * 현재 potCount가 최대치보다 클 경우 자동 보정
   */
  useEffect(() => {
    if (potCount > maxPotCountBySkill) {
      setPotCount(maxPotCountBySkill);
      setIsDirty(true);
    }
  }, [maxPotCountBySkill, potCount]);

  /**
   * 계산 버튼
   */
  const handleCalculate = () => {
    const nextResult = calculateFarming(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  };

  /**
   * 전체 입력 초기화
   */
  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);

    setBlessingOfHarvest(INITIAL_FORM.blessingOfHarvest);
    setFertileSoil(INITIAL_FORM.fertileSoil);
    setOathOfCultivation(INITIAL_FORM.oathOfCultivation);

    setPotCount(INITIAL_FORM.potCount);
    setThirst(INITIAL_FORM.thirst);
    setCropType(INITIAL_FORM.cropType);

    setNormalPrice(INITIAL_FORM.normalPrice);
    setAdvancedPrice(INITIAL_FORM.advancedPrice);
    setRarePrice(INITIAL_FORM.rarePrice);

    setResult(calculateFarming(createInitialCalculationInput()));
    setIsDirty(false);

    setExpPerHarvest(1);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  /**
   * 경험치 계산 버튼
   * - 핵심: expectedHarvestAttemptsPerCycle 사용
   */
  const handleCalculateExp = () => {
    const nextExp = calculateFarmingExp({
      expectedHarvestAttemptsPerCycle:
        result.intermediate.expectedHarvestAttemptsPerCycle,
      expPerHarvest,
      remainingExp,
    });

    setExpResult(nextExp);
    setIsExpDirty(false);
  };

  /**
   * 경험치 입력 초기화
   */
  const handleResetExp = () => {
    setExpPerHarvest(1);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  const selectedCrop = cropOptions.find((item) => item.value === cropType);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">농사 결과물 계산기</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* =========================
            왼쪽: 입력 영역
           ========================= */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">입력값</h2>

          {profileLoaded && (
            <div className="mb-5 rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm">
              <p className="font-medium text-emerald-300">
                프로필 데이터를 불러왔습니다.
              </p>
              <p className="mt-1 text-zinc-300">
                플랜: {isProUser ? "Pro" : "Free"}
              </p>
              <p className="mt-1 text-zinc-400">
                {isProUser
                  ? "→ 프로필 기반 농사 스탯/스킬 값을 수정할 수 있습니다."
                  : "→ 프로필에서 불러온 농사 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
              </p>
            </div>
          )}

          {/* 스탯 */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">농사 스탯</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">행운</span>
                <input
                  type="number"
                  value={luck}
                  onChange={(e) => {
                    setLuck(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">감각</span>
                <input
                  type="number"
                  value={sense}
                  onChange={(e) => {
                    setSense(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>
            </div>
          </div>

          {/* 스킬 */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">농사 스킬</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  풍년의 축복
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={blessingOfHarvest}
                  onChange={(e) => {
                    setBlessingOfHarvest(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  비옥한 토양
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={fertileSoil}
                  onChange={(e) => {
                    setFertileSoil(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  개간의 서약
                </span>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={oathOfCultivation}
                  onChange={(e) => {
                    setOathOfCultivation(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>
            </div>
          </div>

          {/* 환경 / 작물 / 화분통 */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">재배 정보</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  작물 선택
                </span>
                <select
                  value={cropType}
                  onChange={(e) => {
                    setCropType(e.target.value as FarmingCropType);
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                >
                  {cropOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  총 화분통 개수
                </span>
                <input
                  type="number"
                  min={0}
                  max={maxPotCountBySkill}
                  value={potCount}
                  onChange={(e) => {
                    const next = parseNumber(e.target.value);
                    setPotCount(Math.min(next, maxPotCountBySkill));
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm text-zinc-300">
                  갈증 수치
                </span>
                <input
                  type="number"
                  min={0}
                  value={thirst}
                  onChange={(e) => {
                    setThirst(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  현재 로직 기준: 작물 2개 드롭률 = (갈증 × 5) + (감각 × 0.8)
                </p>
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
              <p>선택 작물: {selectedCrop?.label ?? "양배추"}</p>
              <p>개간의 서약 기준 최대 화분통 수: {maxPotCountBySkill.toLocaleString()}개</p>
            </div>
          </div>

          {/* 시세 */}
          <div className="mb-6">
            <h3 className="mb-3 text-lg font-semibold">평균 시세</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  일반 시세
                </span>
                <input
                  type="number"
                  min={0}
                  value={normalPrice}
                  onChange={(e) => {
                    setNormalPrice(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  고급 시세
                </span>
                <input
                  type="number"
                  min={0}
                  value={advancedPrice}
                  onChange={(e) => {
                    setAdvancedPrice(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  희귀 시세
                </span>
                <input
                  type="number"
                  min={0}
                  value={rarePrice}
                  onChange={(e) => {
                    setRarePrice(parseNumber(e.target.value));
                    setIsDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCalculate}
              className="rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
            >
              계산하기
            </button>

            <button
              onClick={handleReset}
              className="rounded-xl border border-zinc-700 px-4 py-2 font-medium text-zinc-200 hover:bg-zinc-800"
            >
              전체 초기화
            </button>

            {isDirty && (
              <span className="self-center text-sm text-amber-400">
                입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
              </span>
            )}
          </div>
        </section>

        {/* =========================
            오른쪽: 결과 영역
           ========================= */}
        <section className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">계산 결과</h2>

          {/* 등급 가중치 / 확률 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-lg font-semibold">등급 비율</h3>
            <div className="space-y-2 text-sm">
              <p>일반 가중치: {formatNumber(result.intermediate.normalWeight, 4)}</p>
              <p>고급 가중치: {formatNumber(result.intermediate.advancedWeight, 4)}</p>
              <p>희귀 가중치: {formatNumber(result.intermediate.rareWeight, 4)}</p>
              <p>전체 가중치 합: {formatNumber(result.intermediate.totalWeight, 4)}</p>
              <hr className="border-zinc-800" />
              <p>일반 확률: {toPercent(result.intermediate.normalProbability)}</p>
              <p>고급 확률: {toPercent(result.intermediate.advancedProbability)}</p>
              <p>희귀 확률: {toPercent(result.intermediate.rareProbability)}</p>
            </div>
          </div>

          {/* 기타 비율 / 중간 계산 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-lg font-semibold">중간 계산값</h3>
            <div className="space-y-2 text-sm">
              <p>씨앗 드롭률: {formatNumber(result.intermediate.seedDropRatePercent, 2)}%</p>
              <p>비옥한 토양 발동률: {formatNumber(result.intermediate.fertileSoilRatePercent, 2)}%</p>
              <p>작물 2개 드롭률: {formatNumber(result.intermediate.doubleDropRatePercent, 2)}%</p>
              <hr className="border-zinc-800" />
              <p>
                화분통 1개당 기대 수확 판정 횟수:{" "}
                {formatNumber(result.intermediate.expectedHarvestAttemptsPerPot, 4)}
              </p>
              <p>
                1사이클 총 기대 수확 판정 횟수:{" "}
                {formatNumber(result.intermediate.expectedHarvestAttemptsPerCycle, 4)}
              </p>
              <p>
                수확 1회당 기대 작물 개수:{" "}
                {formatNumber(result.intermediate.expectedCropsPerHarvestAttempt, 4)}
              </p>
              <p>
                1사이클 총 기대 작물 개수:{" "}
                {formatNumber(result.intermediate.expectedTotalCropsPerCycle, 4)}
              </p>
            </div>
          </div>

          {/* 결과물 / 수익 */}
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-lg font-semibold">결과물 기대값</h3>
            <div className="space-y-2 text-sm">
              <p>일반 기대 개수: {formatNumber(result.normalExpectedCount, 4)}개</p>
              <p>고급 기대 개수: {formatNumber(result.advancedExpectedCount, 4)}개</p>
              <p>희귀 기대 개수: {formatNumber(result.rareExpectedCount, 4)}개</p>
              <hr className="border-zinc-800" />
              <p className="text-base font-semibold text-emerald-300">
                1사이클 기대 수익: {formatNumber(result.expectedRevenuePerCycle, 2)}
              </p>
            </div>
          </div>

          {/* 경험치 계산기 */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-lg font-semibold">경험치 계산</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  수확 1회당 획득 경험치
                </span>
                <input
                  type="number"
                  min={0}
                  value={expPerHarvest}
                  onChange={(e) => {
                    setExpPerHarvest(parseNumber(e.target.value));
                    setIsExpDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-zinc-300">
                  잔여 경험치
                </span>
                <input
                  type="number"
                  min={0}
                  value={remainingExp}
                  onChange={(e) => {
                    setRemainingExp(parseNumber(e.target.value));
                    setIsExpDirty(true);
                  }}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={handleCalculateExp}
                className="rounded-xl bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
              >
                경험치 계산
              </button>

              <button
                onClick={handleResetExp}
                className="rounded-xl border border-zinc-700 px-4 py-2 font-medium text-zinc-200 hover:bg-zinc-800"
              >
                경험치 입력 초기화
              </button>

              {isExpDirty && (
                <span className="self-center text-sm text-amber-400">
                  경험치 입력값이 변경되었습니다.
                </span>
              )}
            </div>

            {expResult && (
              <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 text-sm">
                <p>1사이클당 획득 경험치: {formatNumber(expResult.expPerCycle, 4)}</p>
                <p>목표까지 필요한 사이클 수: {formatNumber(expResult.cyclesToGoal, 0)}회</p>
                <p>목표까지 필요한 시간: {formatNumber(expResult.totalHoursToGoal, 2)}시간</p>
                <p>목표까지 필요한 분: {formatNumber(expResult.totalMinutesToGoal, 0)}분</p>
              </div>
            )}

            <p className="mt-3 text-xs text-zinc-500">
              기준: 농사 1사이클 = 15분, 경험치는 수확 판정 횟수 기준으로 계산
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
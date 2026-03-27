"use client";

import { useEffect, useState } from "react";
import { calculateFishing } from "../../src/lib/fishing/calc";
import { supabase } from "@/src/lib/supabase";
import type {
  BaitType,
  GroundbaitType,
  PondState,
  TimeOfDay,
  ThirstMin,
  FishingCalculationInput,
  FishingCalculationResult,
} from "../../src/lib/fishing/types";

/**
 * 미끼 선택 옵션
 * label: 화면에 보이는 이름
 * description: 선택 시 하단 안내 문구에 표시할 설명
 */
const baitOptions: { value: BaitType; label: string; description: string }[] = [
  { value: "none", label: "없음", description: "미끼 미사용" },
  {
    value: "worm",
    label: "지렁이 미끼",
    description: "기척 -5%, 입질 -3%, 고급 +20, 희귀 +10",
  },
  {
    value: "meal",
    label: "어분 미끼",
    description: "기척 -10%, 입질 -5%, 고급 +30, 희귀 +15",
  },
  {
    value: "lure",
    label: "루어 미끼",
    description: "기척 -15%, 입질 -10%, 고급 +40, 희귀 +30",
  },
];

/**
 * 떡밥 선택 옵션
 */
const groundbaitOptions: {
  value: GroundbaitType;
  label: string;
  description: string;
}[] = [
  { value: "none", label: "없음", description: "떡밥 미사용" },
  { value: "plain", label: "평범한 떡밥", description: "기척 -2%" },
  { value: "good", label: "잘만든 떡밥", description: "기척 -2%, 입질 -3%" },
  { value: "rainbow", label: "무지개 떡밥", description: "기척 -5%, 입질 -5%" },
];

/**
 * 초기 입력값
 * - 페이지 첫 진입 시 보여줄 기본값
 * - 이후 result의 초기 계산에도 동일하게 사용
 */
const INITIAL_FORM = {
  luck: 0,
  sense: 0,

  rumoredBait: 0,
  lineTension: 0,
  doubleHook: 0,
  schoolFishing: 0,

  timeOfDay: "day" as TimeOfDay,
  pondState: "abundant" as PondState,

  baitType: "none" as BaitType,
  groundbaitType: "none" as GroundbaitType,
  lureEnchantLevel: 3,
  thirstMin: 10 as ThirstMin, // 기본값: 보통 10 이하에서 주스 마시는 플레이 기준

  useDoubleHook: false,
  useSchoolFishing: false,

  normalPrice: 10,
  advancedPrice: 20,
  rarePrice: 35,
};

/**
 * 초기 result 계산용 입력 객체 생성 함수
 * 컴포넌트 바깥에 둬서 최초 useState 초기값에 안전하게 사용
 */
function createInitialCalculationInput(): FishingCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
    },
    skills: {
      rumoredBait: INITIAL_FORM.rumoredBait,
      lineTension: INITIAL_FORM.lineTension,
      doubleHook: INITIAL_FORM.doubleHook,
      schoolFishing: INITIAL_FORM.schoolFishing,
    },
    environment: {
      timeOfDay: INITIAL_FORM.timeOfDay,
      pondState: INITIAL_FORM.pondState,
      baitType: INITIAL_FORM.baitType,
      groundbaitType: INITIAL_FORM.groundbaitType,
      lureEnchantLevel: INITIAL_FORM.lureEnchantLevel,
      thirstMin: INITIAL_FORM.thirstMin,
      useDoubleHook: INITIAL_FORM.useDoubleHook,
      useSchoolFishing: INITIAL_FORM.useSchoolFishing,
    },
    prices: {
      normal: INITIAL_FORM.normalPrice,
      advanced: INITIAL_FORM.advancedPrice,
      rare: INITIAL_FORM.rarePrice,
    },
  };
}

export default function CalculatorPage() {
  /**
   * =========================
   * 입력 폼 state
   * =========================
   */

  // 프로필 불러오기 여부
  const [profileLoaded, setProfileLoaded] = useState(false);

  // 플랜 타입 및 입력값 수정가능 여부
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  const [rumoredBait, setRumoredBait] = useState(INITIAL_FORM.rumoredBait);
  const [lineTension, setLineTension] = useState(INITIAL_FORM.lineTension);
  const [doubleHook, setDoubleHook] = useState(INITIAL_FORM.doubleHook);
  const [schoolFishing, setSchoolFishing] = useState(INITIAL_FORM.schoolFishing);

  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(INITIAL_FORM.timeOfDay);
  const [pondState, setPondState] = useState<PondState>(INITIAL_FORM.pondState);

  const [baitType, setBaitType] = useState<BaitType>(INITIAL_FORM.baitType);
  const [groundbaitType, setGroundbaitType] = useState<GroundbaitType>(
    INITIAL_FORM.groundbaitType,
  );
  const [lureEnchantLevel, setLureEnchantLevel] = useState(
    INITIAL_FORM.lureEnchantLevel,
  );
  const [thirstMin, setThirstMin] = useState<ThirstMin>(INITIAL_FORM.thirstMin);
  const [useDoubleHook, setUseDoubleHook] = useState(INITIAL_FORM.useDoubleHook);
  const [useSchoolFishing, setUseSchoolFishing] = useState(
    INITIAL_FORM.useSchoolFishing,
  );

  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  /**
   * =========================
   * 결과 state
   * =========================
   * 자동 계산(useMemo) 대신,
   * 버튼 클릭 시에만 갱신되도록 별도 state로 관리
   */
  const [result, setResult] = useState<FishingCalculationResult>(() =>
    calculateFishing(createInitialCalculationInput()),
  );

  /**
   * 사용자가 입력값을 바꿨지만 아직 "계산하기"를 누르지 않은 상태인지 표시
   * true면 현재 결과가 최신 입력값과 다를 수 있다는 뜻
   */
  const [isDirty, setIsDirty] = useState(false);

  // 프로필 페이지 저장값 자동 불러오기
  useEffect(() => {
    let isMounted = true;

    const loadProfileToCalculator = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      // 사용자 프로필 DB에서 플랜 타입 불러오기
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

      // 낚시 프로필 DB에서 정보 불러오기
      const { data: fishingProfile, error: fishingProfileError } = await supabase
        .from("fishing_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (fishingProfileError || !fishingProfile) {
        console.warn("fishing_profiles 조회 실패:", fishingProfileError?.message);
        setPlanType(nextPlanType);
        return;
      }

      const { data: skillLevels, error: skillLevelsError } = await supabase
        .from("user_skill_levels")
        .select("skill_id, skill_level")
        .eq("user_id", user.id);

      if (skillLevelsError) {
        console.warn("user_skill_levels 조회 실패:", skillLevelsError.message);
        return;
      }

      const { data: skillDefinitions, error: skillDefinitionsError } = await supabase
        .from("skill_definitions")
        .select("id, skill_name_ko")
        .eq("job_code", "fishing")
        .eq("is_enabled", true);

      if (skillDefinitionsError) {
        console.warn("skill_definitions 조회 실패:", skillDefinitionsError.message);
        return;
      }

      const skillMap = Object.fromEntries(
        (skillLevels ?? []).map((row) => {
          const matched = (skillDefinitions ?? []).find((def) => def.id === row.skill_id);
          return [matched?.skill_name_ko ?? "", row.skill_level];
        }),
      );

      if (!isMounted) return;

      setLuck(Number(fishingProfile.luck_total ?? INITIAL_FORM.luck));
      setSense(Number(fishingProfile.sense_total ?? INITIAL_FORM.sense));

      setRumoredBait(Number(skillMap["소문난 미끼"] ?? INITIAL_FORM.rumoredBait));
      setLineTension(Number(skillMap["낚싯줄 장력"] ?? INITIAL_FORM.lineTension));
      setDoubleHook(Number(skillMap["쌍걸이"] ?? INITIAL_FORM.doubleHook));
      setSchoolFishing(Number(skillMap["떼낚시"] ?? INITIAL_FORM.schoolFishing));

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
   * =========================
   * 경험치 계산기 state
   * =========================
   * 오른쪽 결과 영역 하단에서 별도로 계산
   * - expPerFish: 커스텀 물고기 1마리당 경험치
   * - remainingExp: 레벨업까지 남은 경험치
   * - expResult: 버튼 클릭 시 계산된 결과
   */
  const [expPerFish, setExpPerFish] = useState(72);
  const [remainingExp, setRemainingExp] = useState(0);

  const [expResult, setExpResult] = useState<{
    catchesPerHour: number;
    expPerHour: number;
    levelUpHours: number;
    levelUpMinutes: number;
  } | null>(null);

  const [isExpDirty, setIsExpDirty] = useState(false);

  const catchesPerHour =
  result.catchTime.totalCycleSeconds > 0
    ? 3600 / result.catchTime.totalCycleSeconds
    : 0;

  const customFishPerHour =
  catchesPerHour * result.catchExpectation.finalCustomFishPerCycle;

  const isProUser = planType === "pro";
  const disableProfileFields = profileLoaded && !isProUser;
  const disableDoubleHookCheckbox = doubleHook <= 0;
  const disableSchoolFishingCheckbox = schoolFishing <= 0;

  useEffect(() => {
    if (doubleHook <= 0 && useDoubleHook) {
      setUseDoubleHook(false);
      setIsDirty(true);
    }
  }, [doubleHook, useDoubleHook]);

  useEffect(() => {
    if (schoolFishing <= 0 && useSchoolFishing) {
      setUseSchoolFishing(false);
      setIsDirty(true);
    }
  }, [schoolFishing, useSchoolFishing]);

  /**
   * 현재 폼 입력값을 계산기 입력 객체로 묶어주는 함수
   * 버튼 클릭 시 이 함수 결과를 calculateFishing에 넣으면 됨
   */
  const buildCalculationInput = (): FishingCalculationInput => {
    return {
      stats: {
        luck,
        sense,
      },
      skills: {
        rumoredBait,
        lineTension,
        doubleHook,
        schoolFishing,
      },
      environment: {
        timeOfDay,
        pondState,
        baitType,
        groundbaitType,
        lureEnchantLevel,
        thirstMin,
        useDoubleHook,
        useSchoolFishing,
      },
      prices: {
        normal: normalPrice,
        advanced: advancedPrice,
        rare: rarePrice,
      },
    };
  };

  /**
   * 계산 버튼 클릭 시 실행
   * 현재 입력값 기준으로 계산 후 결과 state 갱신
   */
  const handleCalculate = () => {
    const nextResult = calculateFishing(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  };

  /**
   * 현재 입력값을 모두 초기값으로 되돌리는 버튼이 필요할 경우를 대비한 함수
   * 지금 UI에 바로 쓰지는 않아도, 나중에 쉽게 추가 가능
   */
  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);

    setRumoredBait(INITIAL_FORM.rumoredBait);
    setLineTension(INITIAL_FORM.lineTension);
    setDoubleHook(INITIAL_FORM.doubleHook);
    setSchoolFishing(INITIAL_FORM.schoolFishing);

    setTimeOfDay(INITIAL_FORM.timeOfDay);
    setPondState(INITIAL_FORM.pondState);

    setBaitType(INITIAL_FORM.baitType);
    setGroundbaitType(INITIAL_FORM.groundbaitType);
    setLureEnchantLevel(INITIAL_FORM.lureEnchantLevel);
    setThirstMin(INITIAL_FORM.thirstMin);

    setUseDoubleHook(INITIAL_FORM.useDoubleHook);
    setUseSchoolFishing(INITIAL_FORM.useSchoolFishing);

    setNormalPrice(INITIAL_FORM.normalPrice);
    setAdvancedPrice(INITIAL_FORM.advancedPrice);
    setRarePrice(INITIAL_FORM.rarePrice);

    setResult(calculateFishing(createInitialCalculationInput()));
    setIsDirty(false);
  };

  /**
   * 현재 선택된 미끼/떡밥 설명 표시용
   */
  const selectedBait = baitOptions.find((item) => item.value === baitType);
  const selectedGroundbait = groundbaitOptions.find(
    (item) => item.value === groundbaitType,
  );

  /**
   * 시간을 "~시간 ~분" 형식으로 변환
   * - 시간이 1 미만이면 0시간 N분으로 표시
   * - 경험치가 0이거나 계산 불가면 null 처리
   */
  const formatLevelUpTime = (hours: number) => {
    if (!Number.isFinite(hours) || hours < 0) {
      return "계산 불가";
    }

    const totalMinutes = Math.ceil(hours * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;

    return `${hh}시간 ${mm}분`;
  };

  /**
   * 경험치 계산
   *
   * 현재 요청 기준:
   * - 시간당 커스텀 물고기 수 =
   *   시간당 전체 기대 획득량 × 커스텀 물고기 확률
   * - 시간당 획득 경험치 =
   *   시간당 커스텀 물고기 수 × 물고기 1마리당 경험치
   *
   * 참고:
   * 예전 "더블 캐치 추가분은 경험치 없음" 정책을 유지하려면
   * finalFishPerCycle 대신 expCatchCountPerCycle 기반으로 바꿔야 함.
   */
  const handleCalculateExp = () => {
    const cyclesPerHour =
      result.catchTime.totalCycleSeconds > 0
        ? 3600 / result.catchTime.totalCycleSeconds
        : 0;

    const expFishPerHour =
      cyclesPerHour * result.catchExpectation.expCatchCountPerCycle;

    const nextExpPerHour = expFishPerHour * expPerFish;

    const levelUpHours =
      nextExpPerHour > 0 ? remainingExp / nextExpPerHour : Number.POSITIVE_INFINITY;

    setExpResult({
      catchesPerHour: cyclesPerHour,
      expPerHour: nextExpPerHour,
      levelUpHours,
      levelUpMinutes: levelUpHours * 60,
    });

    setIsExpDirty(false);
  };

  /**
   * 경험치 계산 입력 초기화
   */
  const handleResetExp = () => {
    setExpPerFish(72);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };
  
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">낚시 예상 수익 계산기</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* =========================
            왼쪽: 입력 영역
            ========================= */}
        <section className="space-y-6 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">입력값</h2>

          {profileLoaded && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              프로필 데이터를 불러왔습니다.
              <div className="mt-1 text-neutral-400">
                플랜: <b>{isProUser ? "Pro" : "Free"}</b> <br></br>
                {isProUser
                  ? "→프로필 기반 낚시 스탯/스킬 값을 수정할 수 있습니다"
                  : "→프로필에서 불러온 낚시 스탯/스킬 값은 수정할 수 없습니다.(Pro 전용기능)"}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">낚시 스탯</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="행운"
                value={luck}
                min={0}
                onChange={(value) => {
                  setLuck(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />

              <NumberField
                label="감각"
                value={sense}
                min={0}
                onChange={(value) => {
                  setSense(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">낚시 스킬</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="소문난 미끼 레벨"
                value={rumoredBait}
                min={0}
                max={30}
                onChange={(value) => {
                  setRumoredBait(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />

              <NumberField
                label="낚싯줄 장력 레벨"
                value={lineTension}
                min={0}
                max={30}
                onChange={(value) => {
                  setLineTension(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />

              <NumberField
                label="쌍걸이 레벨"
                value={doubleHook}
                min={0}
                max={30}
                onChange={(value) => {
                  setDoubleHook(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />

              <NumberField
                label="떼낚시 레벨"
                value={schoolFishing}
                min={0}
                max={30}
                onChange={(value) => {
                  setSchoolFishing(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">환경</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="시간대"
                value={timeOfDay}
                onChange={(value) => {
                  setTimeOfDay(value as TimeOfDay);
                  setIsDirty(true);
                }}
                options={[
                  { value: "day", label: "낮" },
                  { value: "night", label: "밤" },
                ]}
              />

              <SelectField
                label="어장 상태"
                value={pondState}
                onChange={(value) => {
                  setPondState(value as PondState);
                  setIsDirty(true);
                }}
                options={[
                  { value: "abundant", label: "풍부" },
                  { value: "normal", label: "보통" },
                  { value: "depleted", label: "고갈" },
                ]}
              />

              <SelectField
                label="미끼 종류"
                value={baitType}
                onChange={(value) => {
                  setBaitType(value as BaitType);
                  setIsDirty(true);
                }}
                options={baitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <SelectField
                label="떡밥 종류"
                value={groundbaitType}
                onChange={(value) => {
                  setGroundbaitType(value as GroundbaitType);
                  setIsDirty(true);
                }}
                options={groundbaitOptions.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
              />

              <NumberField
                label="미끼 인챈트 레벨 (Lure)"
                value={lureEnchantLevel}
                min={0}
                max={3}
                onChange={(value) => {
                  setLureEnchantLevel(value);
                  setIsDirty(true);
                }}
              />

              <SelectField
                label="갈증 최소치"
                value={String(thirstMin)}
                onChange={(value) => {
                  setThirstMin(Number(value) as ThirstMin);
                  setIsDirty(true);
                }}
                options={[
                  { value: "15", label: "15 이상 유지" },
                  { value: "10", label: "10 이상 유지" },
                  { value: "5", label: "5 이상 유지" },
                  { value: "1", label: "1 이상 유지" },
                ]}
              />
            </div>

            <div className="rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
              <p>
                <span className="font-semibold">선택한 미끼 효과:</span>{" "}
                {selectedBait?.description}
              </p>
              <p className="mt-2">
                <span className="font-semibold">선택한 떡밥 효과:</span>{" "}
                {selectedGroundbait?.description}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">액티브 스킬 사용 여부</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <CheckboxField
                label="쌍걸이 사용"
                checked={useDoubleHook}
                onChange={(value) => {
                  setUseDoubleHook(value);
                  setIsDirty(true);
                }}
                disabled={disableDoubleHookCheckbox}
              />

              <CheckboxField
                label="떼낚시 사용"
                checked={useSchoolFishing}
                onChange={(value) => {
                  setUseSchoolFishing(value);
                  setIsDirty(true);
                }}
                disabled={disableSchoolFishingCheckbox}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">물고기 시세</h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="일반 가격"
                value={normalPrice}
                min={0}
                onChange={(value) => {
                  setNormalPrice(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="고급 가격"
                value={advancedPrice}
                min={0}
                onChange={(value) => {
                  setAdvancedPrice(value);
                  setIsDirty(true);
                }}
              />

              <NumberField
                label="희귀 가격"
                value={rarePrice}
                min={0}
                onChange={(value) => {
                  setRarePrice(value);
                  setIsDirty(true);
                }}
              />
            </div>
          </div>

          {/* 입력값 변경 후 계산 버튼을 눌러야 반영된다는 안내 */}
          <div className="rounded-xl border border-dashed p-4 text-sm text-neutral-400">
            입력값을 수정한 뒤 <span className="font-semibold">계산하기</span> 버튼을 누르면
            결과가 갱신됩니다.
            {isDirty && (
              <p className="mt-2 font-medium text-amber-400">
                현재 입력값이 변경되었습니다. 아직 계산 결과에 반영되지 않았습니다.
              </p>
            )}
          </div>

          {/* 계산/초기화 버튼 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleCalculate}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
            >
              계산하기
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-neutral-900"
            >
              초기값으로 되돌리기
            </button>
          </div>
        </section>

        {/* =========================
            오른쪽: 결과 영역
            ========================= */}
        <section className="space-y-6 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">계산 결과</h2>

          <ResultCard
            title="1회 낚시 시간"
            rows={[
              ["낚싯대 던지는 시간", `${result.catchTime.castStartSeconds.toFixed(2)}초`],
              [
                "표시 기척 시간(인챈트 미적용)",
                `${result.catchTime.displayNibbleSeconds.toFixed(2)}초 (${result.catchTime.displayNibbleTicks.toFixed(2)}틱)`,
              ],
              [
                "실제 기척 시간(인챈트 적용)",
                `${result.catchTime.finalNibbleSeconds.toFixed(2)}초 (${result.catchTime.finalNibbleTicks.toFixed(2)}틱)`,
              ],
              [
                "표시 입질 시간(인챈트 미적용)",
                `${result.catchTime.displayBiteSeconds.toFixed(2)}초 (${result.catchTime.displayBiteTicks.toFixed(2)}틱)`,
              ],
              ["건져올리는 시간", `${result.catchTime.reelInSeconds.toFixed(2)}초`],
              ["※최종 1회 낚시 시간(던짐+기척+입질+건져올림)", `${result.catchTime.totalCycleSeconds.toFixed(2)}초`],
            ]}
          />

          <ResultCard
            title="등급 확률"
            rows={[
              [
                "일반",
                `${(result.gradeRatio.probabilityNormal * 100).toFixed(2)}%`,
              ],
              [
                "고급",
                `${(result.gradeRatio.probabilityAdvanced * 100).toFixed(2)}%`,
              ],
              [
                "희귀",
                `${(result.gradeRatio.probabilityRare * 100).toFixed(2)}%`,
              ],
            ]}
          />

          <ResultCard
            title="결과물 확률"
            rows={[
              [
                "바닐라 결과물 확률",
                `${result.value.vanillaChancePercent.toFixed(2)}%`,
              ],
              [
                "커스텀 물고기 확률",
                `${result.value.customFishChancePercent.toFixed(2)}%`,
              ],
  
            ]}
            />

          <ResultCard
            title="기대 획득량"
            rows={[
              [
                "낚시 1회당 커스텀 물고기 수",
                `${result.catchExpectation.customFishPerCatch.toFixed(3)}마리`,
              ],
              [
                "더블 캐치 확률",
                `${result.catchExpectation.doubleCatchChancePercent.toFixed(2)}%`,
              ],
              [
                "(더블 캐치 적용 후)낚시 1회당 커스텀 물고기 수",
                `${result.catchExpectation.finalCustomFishPerCatch.toFixed(3)}마리`,
              ],
              [
                "2회 낚시 확률",
                `${result.catchExpectation.doubleCastChancePercent.toFixed(2)}%`,
              ],
              [
                "사이클 1회당 기대 낚시 횟수",
                `${result.catchExpectation.catchCountPerCycle.toFixed(3)}회`,
              ],
              [
                "최종 기대 획득량(커스텀 물고기)",
                `${result.catchExpectation.finalCustomFishPerCycle.toFixed(3)}마리`,
              ],
            ]}
          />

          <ResultCard
            title="기대 수익"
            rows={[
              [
                "물고기 1마리 기대가치",
                `${Math.round(result.value.expectedValuePerFish).toLocaleString()}셀`,
              ],
              [
                "시간당 커스텀 물고기 수",
                `${customFishPerHour.toFixed(3)}마리`,
              ],
              [
                "낚시 1회당 기대 수익",
                `${Math.round(result.value.expectedValuePerCycle).toLocaleString()}셀`,
              ],
              [
                "시간당 낚시 횟수",
                `${catchesPerHour.toFixed(2)}회`,
              ],
              [
                "시간당 기대 수익",
                `${Math.round(result.value.expectedValuePerHour).toLocaleString()}셀`,
              ],
            ]}
          />

          <div className="rounded-xl border p-4">
            <h3 className="mb-3 font-semibold">경험치 계산</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="물고기 1마리당 경험치"
                value={expPerFish}
                min={0}
                step={0.1}
                onChange={(value) => {
                // 소수점 첫째 자리까지만 허용
                const rounded = Math.round(value * 10) / 10;
                setExpPerFish(rounded);
                setIsExpDirty(true);
                }}
              />

              <NumberField
                label="잔여 경험치"
                value={remainingExp}
                min={0}
                step={1}
                onChange={(value) => {
                  setRemainingExp(value);
                  setIsExpDirty(true);
                }}
              />
            </div>

            <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
              <div className="flex items-center justify-between gap-4">
                <span className="text-neutral-500">시간당 낚시 횟수</span>
                <span className="text-right font-medium">
                  {expResult
                    ? `${Math.round(expResult.catchesPerHour).toLocaleString()}회`
                    : "-"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-neutral-500">시간당 획득 경험치</span>
                <span className="text-right font-medium">
                  {expResult
                    ? `${Math.round(expResult.expPerHour).toLocaleString()}`
                    : "-"}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-neutral-500">레벨업까지 예상 시간</span>
                <span className="text-right font-medium">
                  {expResult
                    ? formatLevelUpTime(expResult.levelUpHours)
                    : "-"}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-neutral-400">
              오른쪽 경험치 계산도 <span className="font-semibold">계산하기</span> 버튼을
              눌러야 반영됩니다.
              {isExpDirty && (
                <p className="mt-2 font-medium text-amber-400">
                  경험치 입력값이 변경되었습니다. 아직 계산 결과에 반영되지 않았습니다.
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCalculateExp}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                경험치 계산하기
              </button>

              <button
                type="button"
                onClick={handleResetExp}
                className="w-full rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-neutral-900"
              >
                경험치 입력 초기화
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * 숫자 입력 컴포넌트
 * - 공통 스타일 재사용
 * - min/max/step은 선택값
 */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </label>
  );
}

/**
 * select 공통 컴포넌트
 */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * checkbox 공통 컴포넌트
 */
function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

/**
 * 결과 카드 공통 컴포넌트
 * rows는 [왼쪽 제목, 오른쪽 값] 배열
 */
function ResultCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>

      <div className="space-y-2">
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span className="text-neutral-500">{key}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
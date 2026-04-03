"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { calculateFishing } from "@/src/lib/fishing/calc";
import type {
  BaitType,
  FishingCalculationInput,
  GroundbaitType,
  PondState,
  ThirstMin,
  TimeOfDay,
} from "@/src/lib/fishing/types";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";

const baitOptions: {
  value: BaitType;
  label: string;
  descriptionLines: string[];
}[] = [
  {
    value: "none",
    label: "없음",
    descriptionLines: ["미끼 미사용"],
  },
  {
    value: "worm",
    label: "지렁이 미끼",
    descriptionLines: [
      "기척 -5%, 입질 -3%",
      "고급 +20, 희귀 +10",
      "2회낚시 +3%",
    ],
  },
  {
    value: "meal",
    label: "어분 미끼",
    descriptionLines: [
      "기척 -10%, 입질 -5%",
      "고급 +30, 희귀 +15",
      "2회낚시 +5%",
    ],
  },
  {
    value: "lure",
    label: "루어 미끼",
    descriptionLines: [
      "기척 -15%, 입질 -10%",
      "고급 +40, 희귀 +30",
      "2회낚시 +8%",
    ],
  },
];

const groundbaitOptions: {
  value: GroundbaitType;
  label: string;
  descriptionLines: string[];
}[] = [
  {
    value: "none",
    label: "없음",
    descriptionLines: ["떡밥 미사용"],
  },
  {
    value: "plain",
    label: "평범한 떡밥",
    descriptionLines: ["기척 -2%", "소모 -15%"],
  },
  {
    value: "good",
    label: "잘만든 떡밥",
    descriptionLines: ["기척 -2%, 입질 -3%", "소모 -30%, 보통 유지"],
  },
  {
    value: "rainbow",
    label: "무지개 떡밥",
    descriptionLines: ["기척 -5%, 입질 -5%", "소모 -50%, 풍부 취급"],
  },
];

const timeOptions: { value: TimeOfDay; label: string }[] = [
  { value: "day", label: "낮" },
  { value: "night", label: "밤" },
];

const pondOptions: { value: PondState; label: string }[] = [
  { value: "abundant", label: "풍부" },
  { value: "normal", label: "보통" },
  { value: "depleted", label: "고갈" },
];

const thirstOptions: { value: ThirstMin; label: string }[] = [
  { value: 15, label: "15 이상 유지" },
  { value: 10, label: "10 이상 유지" },
  { value: 5, label: "5 이상 유지" },
  { value: 1, label: "1 이상 유지" },
];

const INITIAL_FORM = {
  luck: 0,
  sense: 0,

  /**
   * 도감 효과
   * - 프로필 값 자동 반영
   * - 수동 수정 불가
   */
  normalFishReduction: 0,
  nibbleTimeReduction: 0,

  rumoredBait: 0,
  lineTension: 0,
  doubleHook: 0,
  schoolFishing: 0,
  timeOfDay: "day" as TimeOfDay,
  pondState: "abundant" as PondState,
  baitType: "none" as BaitType,
  groundbaitType: "none" as GroundbaitType,
  lureEnchantLevel: 3,
  thirstMin: 10 as ThirstMin,
  useDoubleHook: false,
  useSchoolFishing: false,
  normalPrice: 10,
  advancedPrice: 20,
  rarePrice: 40,
};

function createInitialCalculationInput(): FishingCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
      normalFishReduction: INITIAL_FORM.normalFishReduction,
      nibbleTimeReduction: INITIAL_FORM.nibbleTimeReduction,
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

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number, digits = 2): string {
  return `${formatNumber(value, digits)}%`;
}

function formatRatioPercent(value: number, digits = 2): string {
  return `${formatNumber(value * 100, digits)}%`;
}

export default function FishingCalculatorPage() {
  const pathname = usePathname();
  const loadingProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  /**
   * 도감 효과
   * - 일반 물고기 감소비율
   * - 기척 시간 감소
   * 프로필에서 자동 불러오기만 하고 수정은 막는다.
   */
  const [normalFishReduction, setNormalFishReduction] = useState(
    INITIAL_FORM.normalFishReduction,
  );
  const [nibbleTimeReduction, setNibbleTimeReduction] = useState(
    INITIAL_FORM.nibbleTimeReduction,
  );

  const [rumoredBait, setRumoredBait] = useState(INITIAL_FORM.rumoredBait);
  const [lineTension, setLineTension] = useState(INITIAL_FORM.lineTension);
  const [doubleHook, setDoubleHook] = useState(INITIAL_FORM.doubleHook);
  const [schoolFishing, setSchoolFishing] = useState(INITIAL_FORM.schoolFishing);

  const [timeOfDay, setTimeOfDay] = useState(INITIAL_FORM.timeOfDay);
  const [pondState, setPondState] = useState(INITIAL_FORM.pondState);
  const [baitType, setBaitType] = useState(INITIAL_FORM.baitType);
  const [groundbaitType, setGroundbaitType] = useState(
    INITIAL_FORM.groundbaitType,
  );
  const [lureEnchantLevel, setLureEnchantLevel] = useState(
    INITIAL_FORM.lureEnchantLevel,
  );
  const [thirstMin, setThirstMin] = useState(INITIAL_FORM.thirstMin);
  const [useDoubleHook, setUseDoubleHook] = useState(INITIAL_FORM.useDoubleHook);
  const [useSchoolFishing, setUseSchoolFishing] = useState(
    INITIAL_FORM.useSchoolFishing,
  );

  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  const [result, setResult] = useState(() =>
    calculateFishing(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const [expPerFish, setExpPerFish] = useState(72);
  const [remainingExp, setRemainingExp] = useState(0);
  const [expResult, setExpResult] = useState<{
    catchesPerHour: number;
    expPerHour: number;
    levelUpHours: number;
  } | null>(null);
  const [isExpDirty, setIsExpDirty] = useState(false);

  const loadProfileToCalculator = useCallback(
    async (options?: { autoCalculate?: boolean }) => {
      if (loadingProfileRef.current) return;
      loadingProfileRef.current = true;

      try {
        let user = null;

        for (let i = 0; i < 5; i++) {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            console.warn("getSession 실패:", error.message);
          }

          if (session?.user) {
            user = session.user;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (!user) {
          setPlanType(null);
          setProfileLoaded(false);
          return;
        }

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

        const { data: fishingProfile, error: fishingProfileError } = await supabase
          .from("fishing_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (fishingProfileError || !fishingProfile) {
          console.warn("fishing_profiles 조회 실패:", fishingProfileError?.message);
          setPlanType(nextPlanType);
          setProfileLoaded(false);
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

        const { data: skillDefinitions, error: skillDefinitionsError } =
          await supabase
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
            const matched = (skillDefinitions ?? []).find(
              (def) => def.id === row.skill_id,
            );
            return [matched?.skill_name_ko ?? "", row.skill_level];
          }),
        );

        /**
         * DB에서 읽은 최신값 확정
         */
        const nextLuck = Number(fishingProfile.luck_total ?? INITIAL_FORM.luck);
        const nextSense = Number(fishingProfile.sense_total ?? INITIAL_FORM.sense);
        const nextNormalFishReduction = Number(
          fishingProfile.normal_fish_reduction_total ??
            INITIAL_FORM.normalFishReduction,
        );
        const nextNibbleTimeReduction = Number(
          fishingProfile.nibble_time_reduction_total ??
            INITIAL_FORM.nibbleTimeReduction,
        );

        const nextRumoredBait = Number(
          skillMap["소문난 미끼"] ?? INITIAL_FORM.rumoredBait,
        );
        const nextLineTension = Number(
          skillMap["낚싯줄 장력"] ?? INITIAL_FORM.lineTension,
        );
        const nextDoubleHook = Number(
          skillMap["쌍걸이"] ?? INITIAL_FORM.doubleHook,
        );
        const nextSchoolFishing = Number(
          skillMap["떼낚시"] ?? INITIAL_FORM.schoolFishing,
        );

        /**
         * UI 표시용 state 반영
         */
        setLuck(nextLuck);
        setSense(nextSense);
        setNormalFishReduction(nextNormalFishReduction);
        setNibbleTimeReduction(nextNibbleTimeReduction);
        setRumoredBait(nextRumoredBait);
        setLineTension(nextLineTension);
        setDoubleHook(nextDoubleHook);
        setSchoolFishing(nextSchoolFishing);

        setPlanType(nextPlanType);
        setProfileLoaded(true);

        /**
         * 자동 계산
         * - state 반영을 기다리지 않고
         *   방금 읽은 최신 프로필 값으로 바로 계산
         */
        if (options?.autoCalculate) {
          const nextInput = buildCalculationInputFromProfile({
            luck: nextLuck,
            sense: nextSense,
            normalFishReduction: nextNormalFishReduction,
            nibbleTimeReduction: nextNibbleTimeReduction,
            rumoredBait: nextRumoredBait,
            lineTension: nextLineTension,
            doubleHook: nextDoubleHook,
            schoolFishing: nextSchoolFishing,
          });

          const nextResult = calculateFishing(nextInput);
          setResult(nextResult);
          setIsDirty(false);
        } else {
          setIsDirty(true);
        }
      } finally {
        loadingProfileRef.current = false;
      }
    },
    [
      timeOfDay,
      pondState,
      baitType,
      groundbaitType,
      lureEnchantLevel,
      thirstMin,
      useDoubleHook,
      useSchoolFishing,
      normalPrice,
      advancedPrice,
      rarePrice,
    ],
  );

  useEffect(() => {
    loadProfileToCalculator();
  }, [pathname, loadProfileToCalculator]);

  useEffect(() => {
    /**
     * 프로필 저장 완료 이벤트를 받으면
     * 최신 낚시 프로필을 다시 읽고
     * 그 값으로 즉시 자동 계산까지 수행한다.
     *
     * 정리:
     * - 기존 파일에는 동일 목적의 profileUpdated 이벤트 useEffect가 2개 있었다.
     * - 자동 계산용 1개만 남겨 중복 리스너를 제거했다.
     */
    const handleProfileUpdated = async () => {
      await loadProfileToCalculator({ autoCalculate: true });
    };

    window.addEventListener("profileUpdated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdated);
    };
  }, [loadProfileToCalculator]);

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

  const buildCalculationInput = (): FishingCalculationInput => {
    return {
      stats: {
        luck,
        sense,
        normalFishReduction,
        nibbleTimeReduction,
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
   * 프로필에서 읽은 최신 값으로
   * 낚시 계산 입력 객체를 직접 만든다.
   *
   * 목적:
   * - state 반영 지연 때문에
   *   자동 계산이 이전 값으로 도는 문제를 막기 위함
   */
  const buildCalculationInputFromProfile = (params: {
    luck: number;
    sense: number;
    normalFishReduction: number;
    nibbleTimeReduction: number;
    rumoredBait: number;
    lineTension: number;
    doubleHook: number;
    schoolFishing: number;
  }): FishingCalculationInput => {
    return {
      stats: {
        luck: params.luck,
        sense: params.sense,
        normalFishReduction: params.normalFishReduction,
        nibbleTimeReduction: params.nibbleTimeReduction,
      },
      skills: {
        rumoredBait: params.rumoredBait,
        lineTension: params.lineTension,
        doubleHook: params.doubleHook,
        schoolFishing: params.schoolFishing,
      },
      environment: {
        /**
         * 계산기에서 사용자가 현재 선택해둔 낚시 환경값은 유지
         */
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

  const handleCalculate = useCallback(() => {
    const nextResult = calculateFishing(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  }, [
    luck,
    sense,
    normalFishReduction,
    nibbleTimeReduction,
    rumoredBait,
    lineTension,
    doubleHook,
    schoolFishing,
    timeOfDay,
    pondState,
    baitType,
    groundbaitType,
    lureEnchantLevel,
    thirstMin,
    useDoubleHook,
    useSchoolFishing,
    normalPrice,
    advancedPrice,
    rarePrice,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);
    setNormalFishReduction(INITIAL_FORM.normalFishReduction);
    setNibbleTimeReduction(INITIAL_FORM.nibbleTimeReduction);

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

    setExpPerFish(72);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  const selectedBait = useMemo(
    () => baitOptions.find((item) => item.value === baitType),
    [baitType],
  );

  const selectedGroundbait = useMemo(
    () => groundbaitOptions.find((item) => item.value === groundbaitType),
    [groundbaitType],
  );

  /**
   * =========================
   * 오른쪽 결과 패널 표시용 파생값
   * =========================
   *
   * 요구사항 기준:
   * - "실제 기척 시간(인챈트 적용)" 아래에 도감-기척 시간 감소 표시
   * - "최종 기척 시간" = 실제 기척 시간 - 도감 효과
   * - 시간당 값들도 이 최종 표시 시간을 기준으로 일관되게 다시 계산
   */
  const displayedFinalNibbleSeconds = Math.max(
    result.catchTime.finalNibbleSeconds - nibbleTimeReduction,
    0,
  );
  const displayedFinalNibbleTicks = displayedFinalNibbleSeconds * 20;

  const displayedTotalCycleSeconds =
    result.catchTime.castStartSeconds +
    displayedFinalNibbleSeconds +
    result.catchTime.displayBiteSeconds +
    result.catchTime.reelInSeconds;

  const cyclesPerHour =
    displayedTotalCycleSeconds > 0 ? 3600 / displayedTotalCycleSeconds : 0;

  const customFishPerHour =
    cyclesPerHour * result.catchExpectation.finalCustomFishPerCycle;

  const expectedValuePerHour =
    cyclesPerHour * result.value.expectedValuePerCycle;

  const formatLevelUpTime = (hours: number) => {
    if (!Number.isFinite(hours) || hours < 0) return "계산 불가";

    const totalMinutes = Math.ceil(hours * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${hh}시간 ${mm}분`;
  };

  const handleCalculateExp = () => {
    const nextCyclesPerHour =
      displayedTotalCycleSeconds > 0 ? 3600 / displayedTotalCycleSeconds : 0;

    const expFishPerHour =
      nextCyclesPerHour * result.catchExpectation.expCatchCountPerCycle;

    const nextExpPerHour = expFishPerHour * expPerFish;

    const levelUpHours =
      nextExpPerHour > 0
        ? remainingExp / nextExpPerHour
        : Number.POSITIVE_INFINITY;

    setExpResult({
      catchesPerHour: nextCyclesPerHour,
      expPerHour: nextExpPerHour,
      levelUpHours,
    });
    setIsExpDirty(false);
  };

  const handleResetExp = () => {
    setExpPerFish(72);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  return (
    <CalculatorLayout
      title="낚시 계산기"
      left={
        <div className="space-y-6">
          <CalculatorPanel title="입력값">
            <div className="space-y-6">
              {profileLoaded && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <p className="font-semibold">프로필 데이터를 불러왔습니다.</p>
                  <p className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</p>
                  <p className="mt-1">
                    {isProUser
                      ? "→ 프로필 기반 낚시 스탯/스킬 값을 수정할 수 있습니다."
                      : "→ 프로필에서 불러온 낚시 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 스탯</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="행운">
                    <NumberInput
                      value={luck}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setLuck(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="감각">
                    <NumberInput
                      value={sense}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setSense(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">도감 효과</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="일반 물고기 감소비율">
                    <NumberInput
                      value={normalFishReduction}
                      min={0}
                      max={9999}
                      disabled
                      onChange={() => {}}
                    />
                  </Field>

                  <Field label="기척 시간 감소">
                    <NumberInput
                      value={nibbleTimeReduction}
                      min={0}
                      max={9999}
                      disabled
                      onChange={() => {}}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 스킬</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="소문난 미끼">
                    <NumberInput
                      value={rumoredBait}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setRumoredBait(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="낚싯줄 장력">
                    <NumberInput
                      value={lineTension}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setLineTension(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="쌍걸이">
                    <NumberInput
                      value={doubleHook}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setDoubleHook(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="떼낚시">
                    <NumberInput
                      value={schoolFishing}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setSchoolFishing(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">낚시 환경</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="시간대">
                    <SelectInput
                      value={timeOfDay}
                      options={timeOptions}
                      onChange={(value) => {
                        setTimeOfDay(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="어장 상태">
                    <SelectInput
                      value={pondState}
                      options={pondOptions}
                      onChange={(value) => {
                        setPondState(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="미끼">
                    <SelectInput
                      value={baitType}
                      options={baitOptions.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) => {
                        setBaitType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="떡밥">
                    <SelectInput
                      value={groundbaitType}
                      options={groundbaitOptions.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) => {
                        setGroundbaitType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="Lure 인챈트">
                    <NumberInput
                      value={lureEnchantLevel}
                      min={0}
                      max={3}
                      onChange={(value) => {
                        setLureEnchantLevel(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="갈증 최소치">
                    <SelectInput
                      value={thirstMin.toString()}
                      options={thirstOptions.map(({ value, label }) => ({
                        value: value.toString(),
                        label,
                      }))}
                      onChange={(value) => {
                        setThirstMin(Number(value) as ThirstMin);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      선택 미끼 효과: {selectedBait?.label ?? "없음"}
                    </p>
                    <div className="mt-2 space-y-0.5 leading-6">
                      {(selectedBait?.descriptionLines ?? ["미끼 미사용"]).map(
                        (line) => (
                          <p key={line}>{line}</p>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      선택 떡밥 효과: {selectedGroundbait?.label ?? "없음"}
                    </p>
                    <div className="mt-2 space-y-0.5 leading-6">
                      {(
                        selectedGroundbait?.descriptionLines ?? ["떡밥 미사용"]
                      ).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      ※ 자원 소모/어장 상태 보정 효과는 안내용이며, 시간당 수익 계산에는
                      직접 반영하지 않았습니다.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={useDoubleHook}
                      disabled={disableDoubleHookCheckbox}
                      onChange={(e) => {
                        setUseDoubleHook(e.target.checked);
                        setIsDirty(true);
                      }}
                    />
                    <span>
                      쌍걸이 사용
                      {disableDoubleHookCheckbox && " (레벨 0)"}
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
                    <input
                      type="checkbox"
                      checked={useSchoolFishing}
                      disabled={disableSchoolFishingCheckbox}
                      onChange={(e) => {
                        setUseSchoolFishing(e.target.checked);
                        setIsDirty(true);
                      }}
                    />
                    <span>
                      떼낚시 사용
                      {disableSchoolFishingCheckbox && " (레벨 0)"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">평균 시세</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="일반">
                    <NumberInput
                      value={normalPrice}
                      min={0}
                      onChange={(value) => {
                        setNormalPrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="고급">
                    <NumberInput
                      value={advancedPrice}
                      min={0}
                      onChange={(value) => {
                        setAdvancedPrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  <Field label="희귀">
                    <NumberInput
                      value={rarePrice}
                      min={0}
                      onChange={(value) => {
                        setRarePrice(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
                <ActionButton onClick={handleReset} variant="secondary">
                  전체 초기화
                </ActionButton>
              </div>

              {isDirty && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
                </div>
              )}
            </div>
          </CalculatorPanel>
        </div>
      }
      right={
        <CalculatorPanel title="계산 결과">
          <ResultCard title="낚시 시간">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>낚싯대 던지는 시간</span>
                <span>{formatNumber(result.catchTime.castStartSeconds, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>표시 기척 시간(인챈트 미적용)</span>
                <span>
                  {formatNumber(result.catchTime.displayNibbleSeconds, 2)}초 (
                  {formatNumber(result.catchTime.displayNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>실제 기척 시간(인챈트 적용)</span>
                <span>
                  {formatNumber(result.catchTime.finalNibbleSeconds, 2)}초 (
                  {formatNumber(result.catchTime.finalNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>[도감]기척 시간 감소</span>
                <span>{formatNumber(nibbleTimeReduction, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>최종 기척 시간</span>
                <span>
                  {formatNumber(displayedFinalNibbleSeconds, 2)}초 (
                  {formatNumber(displayedFinalNibbleTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>표시 입질 시간</span>
                <span>
                  {formatNumber(result.catchTime.displayBiteSeconds, 2)}초 (
                  {formatNumber(result.catchTime.displayBiteTicks, 2)}틱)
                </span>
              </div>
              <div className="flex justify-between">
                <span>건져올리는 시간</span>
                <span>{formatNumber(result.catchTime.reelInSeconds, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>※최종 1회 낚시 시간(던짐+기척+입질+건져올림)</span>
                <span>{formatNumber(displayedTotalCycleSeconds, 2)}초</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="등급 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>[도감]일반 물고기 감소비율</span>
                <span>{formatNumber(normalFishReduction, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>일반 가중치</span>
                <span>{formatNumber(result.gradeRatio.rawNormal, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 가중치</span>
                <span>{formatNumber(result.gradeRatio.rawAdvanced, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 가중치</span>
                <span>{formatNumber(result.gradeRatio.rawRare, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>전체 가중치 합</span>
                <span>
                  {formatNumber(
                    result.gradeRatio.rawNormal +
                      result.gradeRatio.rawAdvanced +
                      result.gradeRatio.rawRare,
                    2,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>일반 확률</span>
                <span>
                  {formatRatioPercent(result.gradeRatio.probabilityNormal, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>고급 확률</span>
                <span>
                  {formatRatioPercent(result.gradeRatio.probabilityAdvanced, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>희귀 확률</span>
                <span>{formatRatioPercent(result.gradeRatio.probabilityRare, 2)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="결과물 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>바닐라 결과물 확률</span>
                <span>{formatPercent(result.value.vanillaChancePercent, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>커스텀 물고기 확률</span>
                <span>{formatPercent(result.value.customFishChancePercent, 2)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 획득량">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>더블 캐치 확률</span>
                <span>
                  {formatPercent(
                    result.catchExpectation.doubleCatchChancePercent,
                    2,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>낚시 1회당 기대 커스텀 물고기 수</span>
                <span>
                  {formatNumber(
                    result.catchExpectation.finalCustomFishPerCatch,
                    3,
                  )}
                  마리
                </span>
              </div>
              <div className="flex justify-between">
                <span>2회 낚시 확률</span>
                <span>
                  {formatPercent(result.catchExpectation.doubleCastChancePercent, 2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>1사이클당 기대 낚시 횟수</span>
                <span>
                  {formatNumber(result.catchExpectation.catchCountPerCycle, 3)}회
                </span>
              </div>
              <div className="flex justify-between">
                <span>최종 기대 획득량(물고기 수 x 낚시 횟수)</span>
                <span>
                  {formatNumber(
                    result.catchExpectation.finalCustomFishPerCycle,
                    3,
                  )}
                  개
                </span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 수익">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>물고기 1마리 기대가치</span>
                <span>{formatNumber(result.value.expectedValuePerFish, 2)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>낚시 1회당 기대 수익</span>
                <span>{formatNumber(result.value.expectedValuePerCycle, 2)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>시간당 낚시 횟수</span>
                <span>{Math.floor(cyclesPerHour).toString()}회</span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    시간당 기대 수익
                  </span>
                <span className="text-lg font-bold text-blue-700">
                  {Math.floor(expectedValuePerHour).toString()}셀
                </span>
                </div>
            </div>
          </ResultCard>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">경험치 계산기</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="물고기 1마리당 경험치">
                <NumberInput
                  value={expPerFish}
                  min={0}
                  onChange={(value) => {
                    setExpPerFish(value);
                    setIsExpDirty(true);
                  }}
                />
              </Field>

              <Field label="레벨업까지 남은 경험치">
                <NumberInput
                  value={remainingExp}
                  min={0}
                  onChange={(value) => {
                    setRemainingExp(value);
                    setIsExpDirty(true);
                  }}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton onClick={handleCalculateExp}>경험치 계산</ActionButton>
              <ActionButton variant="secondary" onClick={handleResetExp}>
                경험치 초기화
              </ActionButton>
            </div>

            {isExpDirty && (
              <div className="mt-3 text-sm text-amber-700">
                경험치 입력값이 변경되었습니다.
              </div>
            )}
            <br></br>
            {expResult && (
              <ResultCard title="경험치 결과">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>시간당 획득 경험치</span>
                    <span>{Math.floor(expResult.expPerHour).toString()} exp</span>
                  </div>
                  <div className="flex justify-between">
                    <span>레벨업까지 예상 시간</span>
                    <span>{formatLevelUpTime(expResult.levelUpHours)}</span>
                  </div>
                </div>
              </ResultCard>
            )}
          </div>
        </CalculatorPanel>
      }
    />
  );
}
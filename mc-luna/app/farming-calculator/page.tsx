"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { calculateFarming } from "@/src/lib/farming/calc";
import { calculateFarmingExp } from "@/src/lib/farming/exp";
import { OATH_OF_CULTIVATION_MAX_POTS } from "@/src/lib/farming/skillTables";
import type {
  FarmingCalculationInput,
  FarmingCalculationResult,
  FarmingCropType,
} from "@/src/lib/farming/types";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";

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

type ThirstMin = 15 | 10 | 5 | 1 | 0;

const thirstMinOptions: { value: string; label: string }[] = [
  { value: "15", label: "15 이상 유지" },
  { value: "10", label: "10 이상 유지" },
  { value: "5", label: "5 이상 유지" },
  { value: "1", label: "1 이상 유지" },
  { value: "0", label: "0 이상 유지" },
];

const THIRST_MIN_WEIGHTS: Record<ThirstMin, number> = {
  15: 1,
  10: 0.75,
  5: 0.5,
  1: 0.25,
  0: 0,
};

function getWeightedThirstValue(thirstMin: ThirstMin): number {
  return thirstMin * THIRST_MIN_WEIGHTS[thirstMin];
}

const INITIAL_FORM = {
  luck: 0,
  sense: 0,

  /**
   * 도감 효과
   * - 일반 작물 감소비율
   * 프로필에서 자동 불러오며 계산에 반영
   */
  normalCropReduction: 0,

  blessingOfHarvest: 0,
  fertileSoil: 0,
  oathOfCultivation: 0,
  handOfHarvest: 0,
  reseeding: 0,
  thirstMin: 0 as ThirstMin,
  cropType: "cabbage" as FarmingCropType,
  normalPrice: 4,
  advancedPrice: 9,
  rarePrice: 12,
};

function createInitialCalculationInput(): FarmingCalculationInput {
  const initialMaxPots =
    OATH_OF_CULTIVATION_MAX_POTS[INITIAL_FORM.oathOfCultivation] ?? 96;

  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
      normalCropReduction: INITIAL_FORM.normalCropReduction,
    },
    skills: {
      blessingOfHarvest: INITIAL_FORM.blessingOfHarvest,
      fertileSoil: INITIAL_FORM.fertileSoil,
      oathOfCultivation: INITIAL_FORM.oathOfCultivation,
      handOfHarvest: INITIAL_FORM.handOfHarvest,
      reseeding: INITIAL_FORM.reseeding,
    },
    environment: {
      potCount: initialMaxPots,
      thirst: getWeightedThirstValue(INITIAL_FORM.thirstMin),
      cropType: INITIAL_FORM.cropType,
    },
    prices: {
      normal: INITIAL_FORM.normalPrice,
      advanced: INITIAL_FORM.advancedPrice,
      rare: INITIAL_FORM.rarePrice,
    },
  };
}

function toPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export default function FarmingCalculatorPage() {
  const pathname = usePathname();
  const loadingProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);

  /**
   * 도감 효과
   * - 항상 회색 read-only 표시
   * - 프로필에서 불러온 값을 그대로 사용
   */
  const [normalCropReduction, setNormalCropReduction] = useState(
    INITIAL_FORM.normalCropReduction,
  );

  const [blessingOfHarvest, setBlessingOfHarvest] = useState(
    INITIAL_FORM.blessingOfHarvest,
  );
  const [fertileSoil, setFertileSoil] = useState(INITIAL_FORM.fertileSoil);
  const [oathOfCultivation, setOathOfCultivation] = useState(
    INITIAL_FORM.oathOfCultivation,
  );

  const [handOfHarvest, setHandOfHarvest] = useState(INITIAL_FORM.handOfHarvest);
  const [reseeding, setReseeding] = useState(INITIAL_FORM.reseeding);

  const [thirstMin, setThirstMin] = useState<ThirstMin>(INITIAL_FORM.thirstMin);
  const [cropType, setCropType] = useState(INITIAL_FORM.cropType);

  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  const [result, setResult] = useState<FarmingCalculationResult>(() =>
    calculateFarming(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const [expPerHarvest, setExpPerHarvest] = useState(1);
  const [remainingExp, setRemainingExp] = useState(0);
  const [expResult, setExpResult] = useState<{
    expPerCycle: number;
    cyclesToGoal: number;
    totalMinutesToGoal: number;
    totalHoursToGoal: number;
  } | null>(null);
  const [isExpDirty, setIsExpDirty] = useState(false);

  const maxPotCountBySkill = useMemo(() => {
    return OATH_OF_CULTIVATION_MAX_POTS[oathOfCultivation] ?? 96;
  }, [oathOfCultivation]);

  const weightedThirstValue = useMemo(() => {
    return getWeightedThirstValue(thirstMin);
  }, [thirstMin]);

  const isProUser = planType === "pro";
  const disableProfileFields = profileLoaded && !isProUser;

  const buildCalculationInput = (): FarmingCalculationInput => {
    return {
      stats: {
        luck,
        sense,
        normalCropReduction,
      },
      skills: {
        blessingOfHarvest,
        fertileSoil,
        oathOfCultivation,
        handOfHarvest,
        reseeding,
      },
      environment: {
        potCount: maxPotCountBySkill,
        thirst: weightedThirstValue,
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
   * 프로필에서 읽어온 "원시 값"으로 바로 계산 입력 객체를 만든다.
   *
   * 왜 필요한가?
   * - setLuck, setSense 같은 setState는 비동기라서
   *   직후 handleCalculate()를 호출하면 이전 state로 계산될 수 있다.
   * - 그래서 자동 계산 시에는 DB에서 읽은 최신 값으로
   *   계산 입력 객체를 직접 만들어 사용하는 것이 안전하다.
   */
  const buildCalculationInputFromProfile = (params: {
    luck: number;
    sense: number;
    normalCropReduction: number;
    blessingOfHarvest: number;
    fertileSoil: number;
    oathOfCultivation: number;
    handOfHarvest: number;
    reseeding: number;
  }): FarmingCalculationInput => {
    const nextMaxPotCount =
      OATH_OF_CULTIVATION_MAX_POTS[params.oathOfCultivation] ?? 96;

    return {
      stats: {
        luck: params.luck,
        sense: params.sense,
        normalCropReduction: params.normalCropReduction,
      },
      skills: {
        blessingOfHarvest: params.blessingOfHarvest,
        fertileSoil: params.fertileSoil,
        oathOfCultivation: params.oathOfCultivation,
        handOfHarvest: params.handOfHarvest,
        reseeding: params.reseeding,
      },
      environment: {
        /**
         * 작물 종류 / 갈증 최소치 / 시세는
         * 사용자가 현재 계산기에서 선택해둔 값을 유지한다.
         */
        potCount: nextMaxPotCount,
        thirst: weightedThirstValue,
        cropType,
      },
      prices: {
        normal: normalPrice,
        advanced: advancedPrice,
        rare: rarePrice,
      },
    };
  };

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
          
          if (i < 4) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
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

        const { data: farmingProfile, error: farmingProfileError } = await supabase
          .from("farming_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (farmingProfileError || !farmingProfile) {
          console.warn("farming_profiles 조회 실패:", farmingProfileError?.message);
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
            .eq("job_code", "farming")
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
         * 1) 먼저 DB에서 읽은 최신 값을 지역 변수로 확정한다.
         * 2) 이 값을 state에도 넣고
         * 3) 필요하면 이 값으로 즉시 자동 계산까지 수행한다.
         */
        const nextLuck = Number(farmingProfile.luck_total ?? INITIAL_FORM.luck);
        const nextSense = Number(farmingProfile.sense_total ?? INITIAL_FORM.sense);
        const nextNormalCropReduction = Number(
          farmingProfile.normal_crop_reduction_total ??
            INITIAL_FORM.normalCropReduction,
        );

        const nextBlessingOfHarvest = Number(
          skillMap["풍년의 축복"] ?? INITIAL_FORM.blessingOfHarvest,
        );
        const nextFertileSoil = Number(
          skillMap["비옥한 토양"] ?? INITIAL_FORM.fertileSoil,
        );
        const nextOathOfCultivation = Number(
          skillMap["개간의 서약"] ?? INITIAL_FORM.oathOfCultivation,
        );
        const nextHandOfHarvest = Number(
          skillMap["수확의 손길"] ?? INITIAL_FORM.handOfHarvest,
        );
        const nextReseeding = Number(
          skillMap["되뿌리기"] ?? INITIAL_FORM.reseeding,
        );

        /**
         * UI 표시용 state 반영
         */
        setLuck(nextLuck);
        setSense(nextSense);
        setNormalCropReduction(nextNormalCropReduction);
        setBlessingOfHarvest(nextBlessingOfHarvest);
        setFertileSoil(nextFertileSoil);
        setOathOfCultivation(nextOathOfCultivation);
        setHandOfHarvest(nextHandOfHarvest);
        setReseeding(nextReseeding);

        setPlanType(nextPlanType);
        setProfileLoaded(true);

        /**
         * autoCalculate = true 이면
         * 새 state 반영을 기다리지 않고
         * 방금 읽은 최신 값으로 바로 계산한다.
         */
        if (options?.autoCalculate) {
          const nextInput = buildCalculationInputFromProfile({
            luck: nextLuck,
            sense: nextSense,
            normalCropReduction: nextNormalCropReduction,
            blessingOfHarvest: nextBlessingOfHarvest,
            fertileSoil: nextFertileSoil,
            oathOfCultivation: nextOathOfCultivation,
            handOfHarvest: nextHandOfHarvest,
            reseeding: nextReseeding,
          });

          const nextResult = calculateFarming(nextInput);
          setResult(nextResult);
          setIsDirty(false);
        } else {
          setIsDirty(true);
        }
      } finally {
        loadingProfileRef.current = false;
      }
    },
    [cropType, normalPrice, advancedPrice, rarePrice, weightedThirstValue],
  );

  useEffect(() => {
    /**
     * 프로필 저장 완료 이벤트를 받으면
     * 최신 프로필을 다시 불러오고,
     * 그 값으로 즉시 자동 계산까지 수행한다.
     */
    const handleProfileUpdated = async () => {
      await loadProfileToCalculator({ autoCalculate: true });
    };

    window.addEventListener("profileUpdated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdated);
    };
  }, [loadProfileToCalculator]);

  useEffect(() => {
    loadProfileToCalculator();
  }, [pathname, loadProfileToCalculator]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setPlanType(null);
        setProfileLoaded(false);
        return;
      }

      loadProfileToCalculator();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfileToCalculator]);

  const handleCalculate = useCallback(() => {
    const nextResult = calculateFarming(buildCalculationInput());
    setResult(nextResult);
    setIsDirty(false);
  }, [
    luck,
    sense,
    normalCropReduction,
    blessingOfHarvest,
    fertileSoil,
    oathOfCultivation,
    handOfHarvest,
    reseeding,
    maxPotCountBySkill,
    weightedThirstValue,
    cropType,
    normalPrice,
    advancedPrice,
    rarePrice,
  ]);

  const handleReset = () => {
    setProfileLoaded(false);
    setPlanType(null);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);
    setNormalCropReduction(INITIAL_FORM.normalCropReduction);

    setBlessingOfHarvest(INITIAL_FORM.blessingOfHarvest);
    setFertileSoil(INITIAL_FORM.fertileSoil);
    setOathOfCultivation(INITIAL_FORM.oathOfCultivation);

    setHandOfHarvest(INITIAL_FORM.handOfHarvest);
    setReseeding(INITIAL_FORM.reseeding);

    setThirstMin(INITIAL_FORM.thirstMin);
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

  const handleResetExp = () => {
    setExpPerHarvest(1);
    setRemainingExp(0);
    setExpResult(null);
    setIsExpDirty(false);
  };

  return (
    <CalculatorLayout
      title="농사 계산기"
      left={
        <CalculatorPanel title="능력치 정보">
          {profileLoaded && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <p className="font-semibold">프로필 데이터를 불러왔습니다.</p>
                  <p className="mt-1">플랜: {isProUser ? "Pro" : "Free"}</p>
                  <p className="mt-1">
                    {isProUser
                      ? "→ 프로필 기반 농사 스탯/스킬 값을 수정할 수 있습니다."
                      : "→ 프로필에서 불러온 농사 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    *수확의 손길 / 되뿌리기는 현재 계산 결과에 반영되지 않으며, 프로필 연동 및 확장 대비용으로만 보관됩니다.
                  </p>
                </div>
              )}

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">농사 스탯</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="행운">
                <NumberInput
                  value={luck}
                  onChange={(value) => {
                    setLuck(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>

              <Field label="감각">
                <NumberInput
                  value={sense}
                  onChange={(value) => {
                    setSense(value);
                    setIsDirty(true);
                  }}
                  disabled={disableProfileFields}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">도감 효과</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="일반 작물 감소비율">
                <NumberInput
                  value={normalCropReduction}
                  onChange={() => {}}
                  disabled
                />
              </Field>
            </div>
          </div>

          <h3 className="mb-3 mt-6 text-lg font-semibold">농사 스킬</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="풍년의 축복">
              <NumberInput
                value={blessingOfHarvest}
                onChange={(value) => {
                  setBlessingOfHarvest(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />
            </Field>

            <Field label="비옥한 토양">
              <NumberInput
                value={fertileSoil}
                onChange={(value) => {
                  setFertileSoil(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />
            </Field>

            <Field label="개간의 서약">
              <NumberInput
                value={oathOfCultivation}
                onChange={(value) => {
                  setOathOfCultivation(value);
                  setIsDirty(true);
                }}
                disabled={disableProfileFields}
              />
            </Field>

            <Field label="총 화분통 수">
              <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                {maxPotCountBySkill.toLocaleString()}개
              </div>
            </Field>

            <Field label="수확의 손길 (계산 미반영)">
              <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                Lv.{handOfHarvest}
              </div>
            </Field>

            <Field label="되뿌리기 (계산 미반영)">
              <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                Lv.{reseeding}
              </div>
            </Field>
          </div>

          <h3 className="mb-3 mt-6 text-lg font-semibold">재배 정보</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="작물 종류">
              <SelectInput
                value={cropType}
                onChange={(value) => {
                  setCropType(value as FarmingCropType);
                  setIsDirty(true);
                }}
                options={cropOptions}
              />
            </Field>

            <Field label="갈증 최소치">
              <SelectInput
                value={String(thirstMin)}
                onChange={(value) => {
                  setThirstMin(Number(value) as ThirstMin);
                  setIsDirty(true);
                }}
                options={thirstMinOptions}
              />
            </Field>
          </div>

          <h3 className="mb-3 mt-6 text-lg font-semibold">평균 시세</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="일반">
              <NumberInput
                value={normalPrice}
                onChange={(value) => {
                  setNormalPrice(value);
                  setIsDirty(true);
                }}
              />
            </Field>

            <Field label="고급">
              <NumberInput
                value={advancedPrice}
                onChange={(value) => {
                  setAdvancedPrice(value);
                  setIsDirty(true);
                }}
              />
            </Field>

            <Field label="희귀">
              <NumberInput
                value={rarePrice}
                onChange={(value) => {
                  setRarePrice(value);
                  setIsDirty(true);
                }}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <ActionButton onClick={handleCalculate}>계산하기</ActionButton>
            <ActionButton variant="secondary" onClick={handleReset}>
              전체 초기화
            </ActionButton>
          </div>

          {isDirty && (
            <div className="mt-3 text-sm text-amber-700">
              입력값이 변경되었습니다. 계산하기를 눌러 결과를 갱신하세요.
            </div>
          )}
        </CalculatorPanel>
      }
      right={
        <CalculatorPanel title="계산 결과">
          <ResultCard title="등급 가중치 / 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>풍년의 축복-일반 작물 감소비율</span>
                <span>{formatNumber(result.intermediate.skillNormalReduction, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>도감-일반 작물 감소비율</span>
                <span>{formatNumber(result.intermediate.codexNormalReduction, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>총 일반 작물 감소비율</span>
                <span>{formatNumber(result.intermediate.totalNormalReduction, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>일반 가중치</span>
                <span>{formatNumber(result.intermediate.normalWeight, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 가중치</span>
                <span>{formatNumber(result.intermediate.advancedWeight, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 가중치</span>
                <span>{formatNumber(result.intermediate.rareWeight, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>전체 가중치 합</span>
                <span>{formatNumber(result.intermediate.totalWeight, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>일반 확률</span>
                <span>{toPercent(result.intermediate.normalProbability, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 확률</span>
                <span>{toPercent(result.intermediate.advancedProbability, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 확률</span>
                <span>{toPercent(result.intermediate.rareProbability, 2)}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="중간 계산값">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>선택 갈증 최소치</span>
                <span>{thirstMin} 이상 유지</span>
              </div>
              <div className="flex justify-between">
                <span>계산 반영 갈증값</span>
                <span>{formatNumber(weightedThirstValue, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>씨앗 드롭률</span>
                <span>{formatNumber(result.intermediate.seedDropRatePercent, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>비옥한 토양 발동률</span>
                <span>{formatNumber(result.intermediate.fertileSoilRatePercent, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>작물 2개 드롭률</span>
                <span>{formatNumber(result.intermediate.doubleDropRatePercent, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>화분통 1개당 기대 수확 판정 횟수</span>
                <span>{formatNumber(result.intermediate.expectedHarvestAttemptsPerPot, 2)}회</span>
              </div>
              <div className="flex justify-between">
                <span>1사이클당 총 기대 수확 판정 횟수</span>
                <span>{formatNumber(result.intermediate.expectedHarvestAttemptsPerCycle, 2)}회</span>
              </div>
              <div className="flex justify-between">
                <span>수확 1회당 기대 작물 개수</span>
                <span>{Math.floor(result.intermediate.expectedCropsPerHarvestAttempt).toLocaleString()}개</span>
              </div>
              <div className="flex justify-between">
                <span>1사이클 총 기대 작물 개수</span>
                <span>{Math.floor(result.intermediate.expectedTotalCropsPerCycle).toLocaleString()}개</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 결과">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>일반 기대 개수</span>
                <span>{Math.floor(result.normalExpectedCount).toLocaleString()}개</span>
              </div>
              <div className="flex justify-between">
                <span>고급 기대 개수</span>
                <span>{Math.floor(result.advancedExpectedCount).toLocaleString()}개</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 기대 개수</span>
                <span>{Math.floor(result.rareExpectedCount).toLocaleString()}개</span>
              </div>

              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    1사이클 기대 수익
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {Math.floor(result.expectedRevenuePerCycle).toLocaleString()}셀
                  </span>
                </div>
              </div>
            </div>
          </ResultCard>

          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">경험치 계산기</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="수확 1회당 경험치">
                <NumberInput
                  value={expPerHarvest}
                  onChange={(value) => {
                    setExpPerHarvest(value);
                    setIsExpDirty(true);
                  }}
                />
              </Field>

              <Field label="잔여 경험치">
                <NumberInput
                  value={remainingExp}
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
                경험치 입력 초기화
              </ActionButton>
            </div>

            {isExpDirty && (
              <div className="mt-3 text-sm text-amber-700">
                경험치 입력값이 변경되었습니다.
              </div>
            )}

            {expResult && (
              <ResultCard title="경험치 결과">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>1사이클당 획득 경험치</span>
                    <span>{formatNumber(expResult.expPerCycle, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>목표까지 필요한 사이클 수</span>
                    <span>{formatNumber(expResult.cyclesToGoal, 0)}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span>목표까지 필요한 시간</span>
                    <span>{formatNumber(expResult.totalHoursToGoal, 2)}시간</span>
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
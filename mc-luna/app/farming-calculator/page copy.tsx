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

/**
 * 작물 선택 드롭다운 옵션
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
 * 갈증 최소치 타입
 *
 * 정책:
 * - 사용자가 직접 숫자를 입력하지 않고
 * - "어느 최소치 이상 유지할지"를 선택
 * - 실제 계산에는 아래 최소치에 대응하는 가중치를 적용한 유효 갈증값을 사용
 */
type ThirstMin = 15 | 10 | 5 | 1 | 0;

/**
 * 갈증 최소치 드롭다운 옵션
 */
const thirstMinOptions: { value: string; label: string }[] = [
  { value: "15", label: "15 이상 유지" },
  { value: "10", label: "10 이상 유지" },
  { value: "5", label: "5 이상 유지" },
  { value: "1", label: "1 이상 유지" },
  { value: "0", label: "0 이상 유지" },
];

/**
 * 갈증 최소치별 가중치
 *
 * 요청사항 반영:
 * - 낚시 계산기와 같은 방식의 최소치 가중치 개념 사용
 * - 15, 10, 5, 1, 0에 대해
 *   1, 0.75, 0.5, 0.25, 0 가중치 적용
 *
 * 최종적으로 농사 계산기에서는
 * "작물 2개 드롭률 = (갈증 × 5) + (감각 × 0.8)"
 * 공식을 쓰므로,
 * 여기서는 "실효 갈증값"을 먼저 만든 뒤 calc.ts에 넣는다.
 */
const THIRST_MIN_WEIGHTS: Record<ThirstMin, number> = {
  15: 1,
  10: 0.75,
  5: 0.5,
  1: 0.25,
  0: 0,
};

/**
 * 갈증 최소치 -> 실제 계산에 사용할 유효 갈증값 변환
 *
 * 예:
 * - 15 이상 유지 -> 15 * 1 = 15
 * - 10 이상 유지 -> 10 * 0.75 = 7.5
 * - 5 이상 유지 -> 5 * 0.5 = 2.5
 * - 1 이상 유지 -> 1 * 0.25 = 0.25
 * - 0 이상 유지 -> 0
 *
 * 이 값을 calc.ts의 thirst로 전달한다.
 */
function getWeightedThirstValue(thirstMin: ThirstMin): number {
  return thirstMin * THIRST_MIN_WEIGHTS[thirstMin];
}

/**
 * 페이지 초기 입력값
 *
 * 현재 정책:
 * - 계산에 직접 쓰는 농사 스킬은 3개
 *   (풍년의 축복 / 비옥한 토양 / 개간의 서약)
 * - 수확의 손길 / 되뿌리기는 계산에 사용하지 않지만
 *   프로필 불러오기 및 확장 대비용 state로는 유지
 * - 총 화분통 수는 직접 입력하지 않고 개간의 서약으로 자동 계산
 * - 갈증은 숫자가 아니라 최소치 드롭다운으로 관리
 */
const INITIAL_FORM = {
  // 스탯
  luck: 0,
  sense: 0,

  // 계산 반영 스킬
  blessingOfHarvest: 0,
  fertileSoil: 0,
  oathOfCultivation: 0,

  // 계산 미반영 스킬(표시/확장 대비용)
  handOfHarvest: 0,
  reseeding: 0,

  // 환경
  thirstMin: 0 as ThirstMin,
  cropType: "cabbage" as FarmingCropType,

  // 시세
  normalPrice: 4,
  advancedPrice: 9,
  rarePrice: 12,
};

/**
 * 초기 계산 입력 객체 생성
 *
 * 중요:
 * - 총 화분통 수는 개간의 서약 기준 최대치로 자동 계산
 * - 갈증은 최소치 드롭다운 값에서 가중치 적용 후 계산용 값으로 변환
 */
function createInitialCalculationInput(): FarmingCalculationInput {
  const initialMaxPots =
    OATH_OF_CULTIVATION_MAX_POTS[INITIAL_FORM.oathOfCultivation] ?? 96;

  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
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

  // 계산 반영 스킬
  const [blessingOfHarvest, setBlessingOfHarvest] = useState(
    INITIAL_FORM.blessingOfHarvest,
  );
  const [fertileSoil, setFertileSoil] = useState(INITIAL_FORM.fertileSoil);
  const [oathOfCultivation, setOathOfCultivation] = useState(
    INITIAL_FORM.oathOfCultivation,
  );

  // 계산 미반영 스킬
  const [handOfHarvest, setHandOfHarvest] = useState(INITIAL_FORM.handOfHarvest);
  const [reseeding, setReseeding] = useState(INITIAL_FORM.reseeding);

  // 환경 / 입력
  const [thirstMin, setThirstMin] = useState<ThirstMin>(INITIAL_FORM.thirstMin);
  const [cropType, setCropType] = useState(INITIAL_FORM.cropType);

  // 시세
  const [normalPrice, setNormalPrice] = useState(INITIAL_FORM.normalPrice);
  const [advancedPrice, setAdvancedPrice] = useState(INITIAL_FORM.advancedPrice);
  const [rarePrice, setRarePrice] = useState(INITIAL_FORM.rarePrice);

  /**
   * =========================
   * 결과 state
   * =========================
   * - 버튼 클릭 시에만 결과 반영
   */
  const [result, setResult] = useState<FarmingCalculationResult>(() =>
    calculateFarming(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  /**
   * =========================
   * 경험치 계산 state
   * =========================
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
   *
   * 중요:
   * - ./생활 정보의 "경작지당 화분통 설치 개수" 스탯은 사용하지 않음
   * - 계산기 정책상 화분통 최대치는 개간의 서약 레벨 기준으로 산출
   * - 직접 입력도 받지 않고 자동 계산된 값을 사용
   */
  const maxPotCountBySkill = useMemo(() => {
    return OATH_OF_CULTIVATION_MAX_POTS[oathOfCultivation] ?? 96;
  }, [oathOfCultivation]);

  /**
   * 갈증 최소치 기반 실제 계산용 유효 갈증값
   *
   * 결과 화면에 참고값을 보여주고 싶을 때도 재사용 가능
   */
  const weightedThirstValue = useMemo(() => {
    return getWeightedThirstValue(thirstMin);
  }, [thirstMin]);

  /**
   * Pro 여부
   * - 프로필에서 불러온 스탯/스킬은 Pro만 수정 가능
   */
  const isProUser = planType === "pro";
  const disableProfileFields = profileLoaded && !isProUser;

  /**
   * 계산기 입력 객체 생성
   *
   * 중요:
   * - 총 화분통 수는 별도 입력값이 아니라 maxPotCountBySkill 사용
   * - 갈증은 드롭다운 최소치 -> 가중치 적용 유효 갈증값으로 변환
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
   * 프로필 자동 불러오기
   *
   * 기대 테이블:
   * - profiles(plan_type)
   * - farming_profiles(luck_total, sense_total)
   * - user_skill_levels(skill_id, skill_level)
   * - skill_definitions(id, skill_name_ko, job_code='farming')
   *
   * 현재 정책:
   * - 농사 스킬 5개를 모두 읽어옴
   * - 그러나 실제 계산에 쓰는 것은 3개뿐
   * - 총 화분통 수는 별도 저장값이 아니라 개간의 서약으로 자동 계산
   */
  useEffect(() => {
    let isMounted = true;

    const loadProfileToCalculator = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      /**
       * 1) 플랜 타입 조회
       */
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

      /**
       * 2) farming_profiles 조회
       *
       * 현재 농사 계산기에서 사용하는 스탯:
       * - luck_total
       * - sense_total
       */
      const { data: farmingProfile, error: farmingProfileError } = await supabase
        .from("farming_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (farmingProfileError || !farmingProfile) {
        console.warn("farming_profiles 조회 실패:", farmingProfileError?.message);
        setPlanType(nextPlanType);
        return;
      }

      /**
       * 3) 유저 스킬 레벨 조회
       */
      const { data: skillLevels, error: skillLevelsError } = await supabase
        .from("user_skill_levels")
        .select("skill_id, skill_level")
        .eq("user_id", user.id);

      if (skillLevelsError) {
        console.warn("user_skill_levels 조회 실패:", skillLevelsError.message);
        return;
      }

      /**
       * 4) 농사 스킬 정의 조회
       */
      const { data: skillDefinitions, error: skillDefinitionsError } = await supabase
        .from("skill_definitions")
        .select("id, skill_name_ko")
        .eq("job_code", "farming")
        .eq("is_enabled", true);

      if (skillDefinitionsError) {
        console.warn("skill_definitions 조회 실패:", skillDefinitionsError.message);
        return;
      }

      /**
       * skill_id -> 한글 스킬명 매핑 후
       * "스킬명 -> 레벨" 객체 생성
       */
      const skillMap = Object.fromEntries(
        (skillLevels ?? []).map((row) => {
          const matched = (skillDefinitions ?? []).find(
            (def) => def.id === row.skill_id,
          );
          return [matched?.skill_name_ko ?? "", row.skill_level];
        }),
      );

      if (!isMounted) return;

      /**
       * 5) 스탯 / 스킬 반영
       *
       * 현재 계산 반영:
       * - 풍년의 축복
       * - 비옥한 토양
       * - 개간의 서약
       *
       * 현재 계산 미반영(표시/확장 대비):
       * - 수확의 손길
       * - 되뿌리기
       */
      const nextLuck = Number(farmingProfile.luck_total ?? INITIAL_FORM.luck);
      const nextSense = Number(farmingProfile.sense_total ?? INITIAL_FORM.sense);

      const nextBlessing = Number(
        skillMap["풍년의 축복"] ?? INITIAL_FORM.blessingOfHarvest,
      );
      const nextFertileSoil = Number(
        skillMap["비옥한 토양"] ?? INITIAL_FORM.fertileSoil,
      );
      const nextOath = Number(
        skillMap["개간의 서약"] ?? INITIAL_FORM.oathOfCultivation,
      );

      const nextHandOfHarvest = Number(
        skillMap["수확의 손길"] ?? INITIAL_FORM.handOfHarvest,
      );
      const nextReseeding = Number(
        skillMap["되뿌리기"] ?? INITIAL_FORM.reseeding,
      );

      setLuck(nextLuck);
      setSense(nextSense);

      setBlessingOfHarvest(nextBlessing);
      setFertileSoil(nextFertileSoil);
      setOathOfCultivation(nextOath);

      setHandOfHarvest(nextHandOfHarvest);
      setReseeding(nextReseeding);

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

  /**
   * 경험치 계산 버튼
   *
   * 핵심:
   * - expectedHarvestAttemptsPerCycle 사용
   * - 액티브 스킬(수확의 손길, 되뿌리기)은 현재 계산에 영향 없음
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
          <br></br>
          {/* 스탯 */}
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

          {/* 스킬 */}
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

            {/* 개간의 서약 오른쪽에 자동 계산된 총 화분통 수 표시
                - 직접 입력 불가
                - 현재 개간의 서약 기준 최대치만 보여줌
                - 회색 배경 느낌의 읽기 전용 스타일 */}
            <Field label="총 화분통 수">
              <div className="w-full rounded-xl border bg-gray-100 px-3 py-2 text-gray-700">
                {maxPotCountBySkill.toLocaleString()}개
              </div>
            </Field>

            {/* 아래 2개는 현재 계산 미반영.
                그래도 프로필과 실제 보유 상태를 확인할 수 있게 읽기 전용 표시 유지 */}
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

          {/* 재배 정보 */}
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

          {/* 시세 */}
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
          {/* 등급 가중치 / 확률 */}
          <ResultCard title="등급 가중치 / 확률">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>일반 가중치</span>
                <span>{formatNumber(result.intermediate.normalWeight, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 가중치</span>
                <span>{formatNumber(result.intermediate.advancedWeight, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 가중치</span>
                <span>{formatNumber(result.intermediate.rareWeight, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>전체 가중치 합</span>
                <span>{formatNumber(result.intermediate.totalWeight, 4)}</span>
              </div>
              <div className="flex justify-between">
                <span>일반 확률</span>
                <span>{toPercent(result.intermediate.normalProbability)}</span>
              </div>
              <div className="flex justify-between">
                <span>고급 확률</span>
                <span>{toPercent(result.intermediate.advancedProbability)}</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 확률</span>
                <span>{toPercent(result.intermediate.rareProbability)}</span>
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
                <span>{formatNumber(result.intermediate.expectedHarvestAttemptsPerPot, 4)}회</span>
              </div>
              <div className="flex justify-between">
                <span>1사이클당 총 기대 수확 판정 횟수</span>
                <span>{formatNumber(result.intermediate.expectedHarvestAttemptsPerCycle, 4)}회</span>
              </div>
              <div className="flex justify-between">
                <span>수확 1회당 기대 작물 개수</span>
                <span>{formatNumber(result.intermediate.expectedCropsPerHarvestAttempt, 4)}개</span>
              </div>
              <div className="flex justify-between">
                <span>1사이클 총 기대 작물 개수</span>
                <span>{formatNumber(result.intermediate.expectedTotalCropsPerCycle, 4)}개</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="기대 결과">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>일반 기대 개수</span>
                <span>{formatNumber(result.normalExpectedCount, 4)}개</span>
              </div>
              <div className="flex justify-between">
                <span>고급 기대 개수</span>
                <span>{formatNumber(result.advancedExpectedCount, 4)}개</span>
              </div>
              <div className="flex justify-between">
                <span>희귀 기대 개수</span>
                <span>{formatNumber(result.rareExpectedCount, 4)}개</span>
              </div>

              {/* 요청사항 반영:
                  - 1사이클당 수익 텍스트를 진하게
                  - 연한 파란색 느낌으로 강조 */}
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-900">
                    1사이클 기대 수익
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {formatNumber(result.expectedRevenuePerCycle, 2)}셀
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
                    <span>{formatNumber(expResult.expPerCycle, 4)}</span>
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
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { calculateMining } from "@/src/lib/mining/calc";
import type {
  MiningCalculationInput,
  MiningOreType,
  MiningProcessType,
  MiningRecipeTier,
  MiningThirstMin,
} from "@/src/lib/mining/types";
import CalculatorLayout from "@/src/components/calculator/CalculatorLayout";
import CalculatorPanel from "@/src/components/calculator/CalculatorPanel";
import Field from "@/src/components/calculator/Field";
import NumberInput from "@/src/components/calculator/NumberInput";
import SelectInput from "@/src/components/calculator/SelectInput";
import ActionButton from "@/src/components/calculator/ActionButton";
import ResultCard from "@/src/components/calculator/ResultCard";
import { useRequireProfile } from "@/src/hooks/useRequireProfile";

/**
 * =========================
 * 채광 페이지 옵션 목록
 * =========================
 */

const oreOptions: { value: MiningOreType; label: string; descriptionLines: string[] }[] = [
  {
    value: "mithril",
    label: "미스릴",
    descriptionLines: ["스폰 높이: Y -32 ~ 32", "허름한 화로 제련 가능"],
  },
  {
    value: "argentite",
    label: "아르젠타이트",
    descriptionLines: ["스폰 높이: Y -48 ~ 16", "허름한 화로 제련 가능"],
  },
  {
    value: "vellium",
    label: "벨리움",
    descriptionLines: ["스폰 높이: Y -64 ~ 0", "허름한 화로 제련 가능"],
  },
];

const processOptions: { value: MiningProcessType; label: string }[] = [
  { value: "furnace", label: "허름한 화로 제련" },
  { value: "vellium_synthesis", label: "벨리움 합성" },
];

const recipeOptions: { value: MiningRecipeTier; label: string }[] = [
  { value: "sturdy_vellium", label: "단단한 벨리움" },
  { value: "pure_vellium", label: "순수한 벨리움" },
];

const thirstOptions: { value: MiningThirstMin; label: string }[] = [
  { value: 15, label: "15 이상 유지" },
  { value: 10, label: "10 이상 유지" },
  { value: 5, label: "5 이상 유지" },
  { value: 1, label: "1 이상 유지" },
  { value: 0, label: "0까지 허용" },
];

/**
 * 현재 단계에서는
 * - 공통 스탯 6종
 * - 채광 도감 효과 2종
 * - 채광 스킬 5종
 * 을 구조상 모두 잡아 둔다.
 *
 * 실제 계산 반영 강도는 추후 단계적으로 늘릴 예정.
 */
const INITIAL_FORM = {
  luck: 0,
  sense: 0,
  endurance: 0,
  mastery: 0,
  dexterity: 0,
  charisma: 0,

  /**
   * 도감 효과
   * - 프로필 자동 반영
   * - 수동 수정 불가
   */
  miningDelayReduction: 0,
  miningDamageIncrease: 0,

  temperedPickaxe: 0,
  veinSense: 0,
  veinFlow: 0,
  veinDetection: 0,
  explosiveMining: 0,

  oreType: "mithril" as MiningOreType,
  processType: "furnace" as MiningProcessType,
  recipeTier: "sturdy_vellium" as MiningRecipeTier,
  thirstMin: 15 as MiningThirstMin,

  commonPrice: 100,
  silverPrice: 180,
  goldPrice: 350,
  sturdyVelliumPrice: 1500,
  pureVelliumPrice: 3000,
};

function createInitialCalculationInput(): MiningCalculationInput {
  return {
    stats: {
      luck: INITIAL_FORM.luck,
      sense: INITIAL_FORM.sense,
      endurance: INITIAL_FORM.endurance,
      mastery: INITIAL_FORM.mastery,
      dexterity: INITIAL_FORM.dexterity,
      charisma: INITIAL_FORM.charisma,
      miningDelayReduction: INITIAL_FORM.miningDelayReduction,
      miningDamageIncrease: INITIAL_FORM.miningDamageIncrease,
    },
    skills: {
      temperedPickaxe: INITIAL_FORM.temperedPickaxe,
      veinSense: INITIAL_FORM.veinSense,
      veinFlow: INITIAL_FORM.veinFlow,
      veinDetection: INITIAL_FORM.veinDetection,
      explosiveMining: INITIAL_FORM.explosiveMining,
    },
    environment: {
      oreType: INITIAL_FORM.oreType,
      processType: INITIAL_FORM.processType,
      recipeTier: INITIAL_FORM.recipeTier,
      thirstMin: INITIAL_FORM.thirstMin,
    },
    prices: {
      common: INITIAL_FORM.commonPrice,
      silver: INITIAL_FORM.silverPrice,
      gold: INITIAL_FORM.goldPrice,
      sturdyVellium: INITIAL_FORM.sturdyVelliumPrice,
      pureVellium: INITIAL_FORM.pureVelliumPrice,
    },
  };
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercentFromRatio(value: number, digits = 2): string {
  return `${formatNumber(value * 100, digits)}%`;
}

export default function MiningCalculatorPage() {
  /**
   * 페이지 진입 전 공통 가드
   *
   * 정책:
   * - 로그인 안 되어 있으면 /login
   * - 마인크래프트 프로필 연동이 안 되어 있으면 /profile
   */
  const { loading: guardLoading, allowed } = useRequireProfile({
    loginMessage: "채광 계산기를 사용하려면 로그인이 필요합니다.",
    profileMessage: "채광 계산기를 사용하려면 프로필 연동이 필요합니다.",
  });

  const loadingProfileRef = useRef(false);
  const hasLoadedProfileRef = useRef(false);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [planType, setPlanType] = useState<"free" | "pro" | null>(null);

  /**
   * 공통 스탯
   */
  const [luck, setLuck] = useState(INITIAL_FORM.luck);
  const [sense, setSense] = useState(INITIAL_FORM.sense);
  const [endurance, setEndurance] = useState(INITIAL_FORM.endurance);
  const [mastery, setMastery] = useState(INITIAL_FORM.mastery);
  const [dexterity, setDexterity] = useState(INITIAL_FORM.dexterity);
  const [charisma, setCharisma] = useState(INITIAL_FORM.charisma);

  /**
   * 도감 효과
   */
  const [miningDelayReduction, setMiningDelayReduction] = useState(
    INITIAL_FORM.miningDelayReduction,
  );
  const [miningDamageIncrease, setMiningDamageIncrease] = useState(
    INITIAL_FORM.miningDamageIncrease,
  );

  /**
   * 채광 스킬
   */
  const [temperedPickaxe, setTemperedPickaxe] = useState(
    INITIAL_FORM.temperedPickaxe,
  );
  const [veinSense, setVeinSense] = useState(INITIAL_FORM.veinSense);
  const [veinFlow, setVeinFlow] = useState(INITIAL_FORM.veinFlow);
  const [veinDetection, setVeinDetection] = useState(
    INITIAL_FORM.veinDetection,
  );
  const [explosiveMining, setExplosiveMining] = useState(
    INITIAL_FORM.explosiveMining,
  );

  /**
   * 환경/선택값
   */
  const [oreType, setOreType] = useState(INITIAL_FORM.oreType);
  const [processType, setProcessType] = useState(INITIAL_FORM.processType);
  const [recipeTier, setRecipeTier] = useState(INITIAL_FORM.recipeTier);
  const [thirstMin, setThirstMin] = useState(INITIAL_FORM.thirstMin);

  /**
   * 평균 시세
   */
  const [commonPrice, setCommonPrice] = useState(INITIAL_FORM.commonPrice);
  const [silverPrice, setSilverPrice] = useState(INITIAL_FORM.silverPrice);
  const [goldPrice, setGoldPrice] = useState(INITIAL_FORM.goldPrice);
  const [sturdyVelliumPrice, setSturdyVelliumPrice] = useState(
    INITIAL_FORM.sturdyVelliumPrice,
  );
  const [pureVelliumPrice, setPureVelliumPrice] = useState(
    INITIAL_FORM.pureVelliumPrice,
  );

  const [result, setResult] = useState(() =>
    calculateMining(createInitialCalculationInput()),
  );
  const [isDirty, setIsDirty] = useState(false);

  const buildCalculationInput = (): MiningCalculationInput => ({
    stats: {
      luck,
      sense,
      endurance,
      mastery,
      dexterity,
      charisma,
      miningDelayReduction,
      miningDamageIncrease,
    },
    skills: {
      temperedPickaxe,
      veinSense,
      veinFlow,
      veinDetection,
      explosiveMining,
    },
    environment: {
      oreType,
      processType,
      recipeTier,
      thirstMin,
    },
    prices: {
      common: commonPrice,
      silver: silverPrice,
      gold: goldPrice,
      sturdyVellium: sturdyVelliumPrice,
      pureVellium: pureVelliumPrice,
    },
  });

  /**
   * 프로필 기반 자동 입력값 로드
   *
   * 현재 구조:
   * - profiles 에서 plan_type 조회
   * - mining_profiles 에서 채광 스탯/도감값 조회 시도
   * - user_skill_levels + skill_definitions(job_code = mining) 로 스킬값 조회
   *
   * 주의:
   * - mining_profiles 테이블/컬럼이 아직 완전히 준비되지 않았더라도
   *   페이지가 죽지 않도록 최대한 안전하게 fallback 한다.
   */
  const loadProfileToCalculator = useCallback(async () => {
    if (loadingProfileRef.current) return;
    if (hasLoadedProfileRef.current) return;

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
        hasLoadedProfileRef.current = false;
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
      setPlanType(nextPlanType);

      /**
       * mining_profiles 는 아직 세부 스키마가 조정될 수 있으므로
       * select("*") 후 필요한 값만 읽는다.
       */
      const { data: miningProfile, error: miningProfileError } = await supabase
        .from("mining_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (miningProfileError) {
        console.warn("mining_profiles 조회 실패:", miningProfileError.message);
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
          .eq("job_code", "mining")
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

      const nextLuck = Number(miningProfile?.luck_total ?? INITIAL_FORM.luck);
      const nextSense = Number(miningProfile?.sense_total ?? INITIAL_FORM.sense);
      const nextEndurance = Number(
        miningProfile?.endurance_total ?? INITIAL_FORM.endurance,
      );
      const nextMastery = Number(
        miningProfile?.mastery_total ?? INITIAL_FORM.mastery,
      );
      const nextDexterity = Number(
        miningProfile?.dexterity_total ?? INITIAL_FORM.dexterity,
      );
      const nextCharisma = Number(
        miningProfile?.charisma_total ?? INITIAL_FORM.charisma,
      );

      const nextMiningDelayReduction = Number(
        miningProfile?.mining_delay_reduction_total ??
          INITIAL_FORM.miningDelayReduction,
      );
      const nextMiningDamageIncrease = Number(
        miningProfile?.mining_damage_increase_total ??
          INITIAL_FORM.miningDamageIncrease,
      );

      const nextTemperedPickaxe = Number(
        skillMap["단련된 곡괭이"] ?? INITIAL_FORM.temperedPickaxe,
      );
      const nextVeinSense = Number(
        skillMap["광맥 감각"] ?? INITIAL_FORM.veinSense,
      );
      const nextVeinFlow = Number(
        skillMap["광맥 흐름"] ?? INITIAL_FORM.veinFlow,
      );
      const nextVeinDetection = Number(
        skillMap["광맥 탐지"] ?? INITIAL_FORM.veinDetection,
      );
      const nextExplosiveMining = Number(
        skillMap["폭발적인 채광"] ?? INITIAL_FORM.explosiveMining,
      );

      setLuck(nextLuck);
      setSense(nextSense);
      setEndurance(nextEndurance);
      setMastery(nextMastery);
      setDexterity(nextDexterity);
      setCharisma(nextCharisma);

      setMiningDelayReduction(nextMiningDelayReduction);
      setMiningDamageIncrease(nextMiningDamageIncrease);

      setTemperedPickaxe(nextTemperedPickaxe);
      setVeinSense(nextVeinSense);
      setVeinFlow(nextVeinFlow);
      setVeinDetection(nextVeinDetection);
      setExplosiveMining(nextExplosiveMining);

      setProfileLoaded(Boolean(miningProfile));
      hasLoadedProfileRef.current = true;

      /**
       * 초기 진입 시 결과도 프로필 기준으로 한 번 맞춰 둔다.
       */
      setResult(
        calculateMining({
          stats: {
            luck: nextLuck,
            sense: nextSense,
            endurance: nextEndurance,
            mastery: nextMastery,
            dexterity: nextDexterity,
            charisma: nextCharisma,
            miningDelayReduction: nextMiningDelayReduction,
            miningDamageIncrease: nextMiningDamageIncrease,
          },
          skills: {
            temperedPickaxe: nextTemperedPickaxe,
            veinSense: nextVeinSense,
            veinFlow: nextVeinFlow,
            veinDetection: nextVeinDetection,
            explosiveMining: nextExplosiveMining,
          },
          environment: {
            oreType,
            processType,
            recipeTier,
            thirstMin,
          },
          prices: {
            common: commonPrice,
            silver: silverPrice,
            gold: goldPrice,
            sturdyVellium: sturdyVelliumPrice,
            pureVellium: pureVelliumPrice,
          },
        }),
      );

      setIsDirty(false);
    } finally {
      loadingProfileRef.current = false;
    }
  }, [
    oreType,
    processType,
    recipeTier,
    thirstMin,
    commonPrice,
    silverPrice,
    goldPrice,
    sturdyVelliumPrice,
    pureVelliumPrice,
  ]);

  /**
   * 공통 가드를 통과한 뒤에만
   * 프로필 기반 계산기 자동 입력값을 불러온다.
   */
  useEffect(() => {
    if (guardLoading) return;
    if (!allowed) return;

    loadProfileToCalculator();
  }, [guardLoading, allowed, loadProfileToCalculator]);

  const isProUser = planType === "pro";
  const disableProfileFields = planType !== "pro";

  const selectedOre = useMemo(
    () => oreOptions.find((item) => item.value === oreType),
    [oreType],
  );

  const handleCalculate = useCallback(() => {
    setResult(calculateMining(buildCalculationInput()));
    setIsDirty(false);
  }, [
    luck,
    sense,
    endurance,
    mastery,
    dexterity,
    charisma,
    miningDelayReduction,
    miningDamageIncrease,
    temperedPickaxe,
    veinSense,
    veinFlow,
    veinDetection,
    explosiveMining,
    oreType,
    processType,
    recipeTier,
    thirstMin,
    commonPrice,
    silverPrice,
    goldPrice,
    sturdyVelliumPrice,
    pureVelliumPrice,
  ]);

  const handleReset = () => {
    hasLoadedProfileRef.current = false;
    setProfileLoaded(false);

    setLuck(INITIAL_FORM.luck);
    setSense(INITIAL_FORM.sense);
    setEndurance(INITIAL_FORM.endurance);
    setMastery(INITIAL_FORM.mastery);
    setDexterity(INITIAL_FORM.dexterity);
    setCharisma(INITIAL_FORM.charisma);

    setMiningDelayReduction(INITIAL_FORM.miningDelayReduction);
    setMiningDamageIncrease(INITIAL_FORM.miningDamageIncrease);

    setTemperedPickaxe(INITIAL_FORM.temperedPickaxe);
    setVeinSense(INITIAL_FORM.veinSense);
    setVeinFlow(INITIAL_FORM.veinFlow);
    setVeinDetection(INITIAL_FORM.veinDetection);
    setExplosiveMining(INITIAL_FORM.explosiveMining);

    setOreType(INITIAL_FORM.oreType);
    setProcessType(INITIAL_FORM.processType);
    setRecipeTier(INITIAL_FORM.recipeTier);
    setThirstMin(INITIAL_FORM.thirstMin);

    setCommonPrice(INITIAL_FORM.commonPrice);
    setSilverPrice(INITIAL_FORM.silverPrice);
    setGoldPrice(INITIAL_FORM.goldPrice);
    setSturdyVelliumPrice(INITIAL_FORM.sturdyVelliumPrice);
    setPureVelliumPrice(INITIAL_FORM.pureVelliumPrice);

    setResult(calculateMining(createInitialCalculationInput()));
    setIsDirty(false);
  };

  /**
   * 공통 가드 확인 중이거나 아직 접근이 허용되지 않은 경우
   */
  if (guardLoading || !allowed) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          채광 계산기
        </h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
          로그인 및 프로필 연동 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  return (
    <CalculatorLayout
      title="채광 계산기"
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
                      ? "→ 프로필 기반 채광 스탯/스킬 값을 수정할 수 있습니다."
                      : "→ 프로필에서 불러온 채광 스탯/스킬 값은 수정할 수 없습니다. (Pro 전용)"}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">공통 스탯</h3>
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
                  <Field label="인내력">
                    <NumberInput
                      value={endurance}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setEndurance(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="손재주">
                    <NumberInput
                      value={mastery}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setMastery(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="민첩">
                    <NumberInput
                      value={dexterity}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setDexterity(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="매력">
                    <NumberInput
                      value={charisma}
                      min={0}
                      max={9999}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setCharisma(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">도감 효과</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="채광 딜레이 감소">
                    <NumberInput
                      value={miningDelayReduction}
                      min={0}
                      max={9999}
                      disabled
                      onChange={() => {}}
                    />
                  </Field>
                  <Field label="채광 데미지 증가">
                    <NumberInput
                      value={miningDamageIncrease}
                      min={0}
                      max={9999}
                      disabled
                      onChange={() => {}}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">채광 스킬</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="단련된 곡괭이">
                    <NumberInput
                      value={temperedPickaxe}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setTemperedPickaxe(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="광맥 감각">
                    <NumberInput
                      value={veinSense}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setVeinSense(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="광맥 흐름">
                    <NumberInput
                      value={veinFlow}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setVeinFlow(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="광맥 탐지">
                    <NumberInput
                      value={veinDetection}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setVeinDetection(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="폭발적인 채광">
                    <NumberInput
                      value={explosiveMining}
                      min={0}
                      max={30}
                      disabled={disableProfileFields}
                      onChange={(value) => {
                        setExplosiveMining(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">채광 환경</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="광물 선택">
                    <SelectInput
                      value={oreType}
                      options={oreOptions.map(({ value, label }) => ({
                        value,
                        label,
                      }))}
                      onChange={(value) => {
                        setOreType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                  <Field label="가공 방식">
                    <SelectInput
                      value={processType}
                      options={processOptions}
                      onChange={(value) => {
                        setProcessType(value);
                        setIsDirty(true);
                      }}
                    />
                  </Field>

                  {processType === "vellium_synthesis" && (
                    <Field label="벨리움 합성 레시피">
                      <SelectInput
                        value={recipeTier}
                        options={recipeOptions}
                        onChange={(value) => {
                          setRecipeTier(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                  )}

                  <Field label="갈증 최소치">
                    <SelectInput
                      value={thirstMin.toString()}
                      options={thirstOptions.map(({ value, label }) => ({
                        value: value.toString(),
                        label,
                      }))}
                      onChange={(value) => {
                        setThirstMin(Number(value) as MiningThirstMin);
                        setIsDirty(true);
                      }}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">
                      선택 광물 정보: {selectedOre?.label ?? "미선택"}
                    </p>
                    <div className="mt-2 space-y-0.5 leading-6">
                      {(selectedOre?.descriptionLines ?? ["정보 없음"]).map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-900">벨리움 합성 메모</p>
                    <div className="mt-2 space-y-1 leading-6">
                      <p>고급 + 고급 → 단단한 벨리움</p>
                      <p>희귀 + 희귀 → 순수한 벨리움</p>
                      <p>제작 성공률/시간은 손재주의 영향을 받도록 추후 반영</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-900">평균 시세</h3>

                {processType === "furnace" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="일반 주괴">
                      <NumberInput
                        value={commonPrice}
                        min={0}
                        onChange={(value) => {
                          setCommonPrice(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                    <Field label="은별 주괴">
                      <NumberInput
                        value={silverPrice}
                        min={0}
                        onChange={(value) => {
                          setSilverPrice(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                    <Field label="금별 주괴">
                      <NumberInput
                        value={goldPrice}
                        min={0}
                        onChange={(value) => {
                          setGoldPrice(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="단단한 벨리움">
                      <NumberInput
                        value={sturdyVelliumPrice}
                        min={0}
                        onChange={(value) => {
                          setSturdyVelliumPrice(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                    <Field label="순수한 벨리움">
                      <NumberInput
                        value={pureVelliumPrice}
                        min={0}
                        onChange={(value) => {
                          setPureVelliumPrice(value);
                          setIsDirty(true);
                        }}
                      />
                    </Field>
                  </div>
                )}
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
          <ResultCard title="광물 기본 정보">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>선택 광물</span>
                <span>{result.meta.oreName}</span>
              </div>
              <div className="flex justify-between">
                <span>스폰 높이</span>
                <span>{result.meta.spawnHeightText}</span>
              </div>
              <div className="flex justify-between">
                <span>가공 방식</span>
                <span>{result.meta.processLabel}</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="채광 시간 (임시)">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>기본 채광 시간</span>
                <span>{formatNumber(result.mining.baseMiningSeconds, 2)}초</span>
              </div>
              <div className="flex justify-between">
                <span>총 딜레이 감소</span>
                <span>{formatNumber(result.mining.miningDelayReductionPercent, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>최종 채광 시간</span>
                <span>{formatNumber(result.mining.finalMiningSeconds, 2)}초</span>
              </div>
            </div>
          </ResultCard>

          {processType === "furnace" ? (
            <ResultCard title="허름한 화로 결과 확률">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>일반 주괴</span>
                  <span>{formatPercentFromRatio(result.smelting.commonRate, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>은별 주괴</span>
                  <span>{formatPercentFromRatio(result.smelting.silverRate, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>금별 주괴</span>
                  <span>{formatPercentFromRatio(result.smelting.goldRate, 2)}</span>
                </div>
              </div>
            </ResultCard>
          ) : (
            <ResultCard title="벨리움 합성 결과">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>결과물</span>
                  <span>{result.synthesis.outputLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>성공 확률</span>
                  <span>{formatPercentFromRatio(result.synthesis.successRate, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>제작 시간</span>
                  <span>{formatNumber(result.synthesis.craftSeconds, 2)}초</span>
                </div>
              </div>
            </ResultCard>
          )}

          <ResultCard title="기대 결과물 / 기대 수익">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>1행동당 기대 결과물</span>
                <span>{formatNumber(result.yield.expectedOutputPerAction, 3)}개</span>
              </div>
              <div className="flex justify-between">
                <span>시간당 행동 수</span>
                <span>{formatNumber(result.yield.actionsPerHour, 2)}회</span>
              </div>
              <div className="border-t border-gray-800/20 my-2" />
              <div className="flex justify-between">
                <span>1행동당 기대 수익</span>
                <span>{formatNumber(result.value.expectedValuePerAction, 2)}셀</span>
              </div>
              <div className="flex justify-between">
                <span>시간당 기대 수익</span>
                <span>{formatNumber(result.value.expectedValuePerHour, 2)}셀</span>
              </div>
            </div>
          </ResultCard>

          <ResultCard title="안내">
            <div className="space-y-2 text-sm text-zinc-700">
              {result.notes.map((note) => (
                <p key={note}>• {note}</p>
              ))}
            </div>
          </ResultCard>
        </CalculatorPanel>
      }
    />
  );
}